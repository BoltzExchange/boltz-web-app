import { createBoltzClient } from "boltz-swaps";
import { getCommitmentLockupDetails } from "boltz-swaps/client";
import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import { isFailureStatus, isFinalStatus } from "boltz-swaps/status";
import { type Address, getAddress, parseEther } from "viem";

import { deriveDepositAccount } from "../src/deposit/derivation.ts";
import { type EngineDeps, advanceDeposit } from "../src/deposit/engine.ts";
import { createDepositStorage } from "../src/deposit/storage.ts";
import {
    DepositPhase,
    type DepositRecord,
    type DepositStorage,
} from "../src/deposit/types.ts";
import type { PopulatedEvmTransaction } from "../src/evm/transaction.ts";
import type { Signer } from "../src/interfaces/signer.ts";
import { MemoryKeyValueStore } from "../src/storage/memory.ts";
import {
    ARBITRUM_RPC_URL,
    TBTC_TOKEN_ADDRESS,
    arbitrumPublicClient,
    fundTbtc,
    isArbitrumForkReachable,
    tokenBalance,
} from "./arbitrum.ts";
import {
    BOLTZ_API_URL,
    clnCreateOffer,
    clnOfferReceivedSats,
    elementsGetReceivedByAddress,
    generateLiquidBlock,
    getLiquidAddress,
    hasCommitmentSupport,
    hasSubmarinePair,
    refreshBackendBalanceCache,
    sleep,
    waitForAddressUtxos,
    waitForTxConfirmed,
} from "./regtest.ts";

// Regtest exposes commitment swaps for TBTC, not USDC.
const ASSET = "TBTC";
// TBTC has 18 decimals; Boltz sats are 8.
const satsToTokenAmount = (sats: number): bigint => BigInt(sats) * 10n ** 10n;

const MNEMONIC = "test test test test test test test test test test test junk";

const sends = vi.hoisted(() => [] as { to: string }[]);

// The engine hardcodes the USDC bridge asset, which does not exist on regtest.
vi.mock("../src/deposit/types.ts", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../src/deposit/types.ts")>()),
    DEPOSIT_BRIDGE_ASSET: "TBTC",
}));

// The gas-sponsor emulator mines via anvil impersonation, so its txs carry a
// zeroed signature and the backend rejects them when validating an EVM user
// lockup. Send everything direct-signed instead; the sponsored path itself is
// covered by depositActions.regtest.spec.ts.
vi.mock("../src/deposit/sponsored.ts", async () => {
    const { sendPopulatedTransaction } = await import("../src/evm/sender.ts");
    const { GasAbstractionType } = await import("../src/types.ts");
    const { encodeFunctionData, getAddress, maxUint256 } = await import("viem");
    const { erc20Abi } = await import("../src/generated/evm-abis.ts");

    const sendDirect = async (signer: Signer, tx: PopulatedEvmTransaction) => {
        sends.push({ to: tx.to ?? "" });
        const hash = await sendPopulatedTransaction(
            GasAbstractionType.None,
            signer,
            tx,
        );
        await signer.provider.waitForTransactionReceipt({ hash });
        return hash;
    };

    return {
        sendSponsored: sendDirect,
        ensureUnlimitedApproval: async (
            signer: Signer,
            token: string,
            spender: string,
        ) => {
            await sendDirect(signer, {
                to: getAddress(token),
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [getAddress(spender), maxUint256],
                }),
            });
        },
    };
});

const stackReady =
    (await isArbitrumForkReachable()) && (await hasCommitmentSupport(ASSET));
const submarineReady = stackReady && (await hasSubmarinePair(ASSET, "BTC"));
const describeStack = stackReady ? describe : describe.skip;
const testSubmarine = submarineReady ? test : test.skip;

describeStack("deposit engine (regtest)", () => {
    const arbitrumConfig = buildMainnetConfig({
        filterAssets: (asset) =>
            asset === "BTC" || asset === "L-BTC" || asset === ASSET,
        rpcUrls: { ARB: [ARBITRUM_RPC_URL] },
    });

    const boltz = createBoltzClient({
        ...arbitrumConfig,
        boltzApiUrl: BOLTZ_API_URL,
        network: "regtest",
    });

    const makeStorage = (): DepositStorage =>
        createDepositStorage(
            new MemoryKeyValueStore({
                inMemoryStorageShouldNeverBeUsedInProduction: true,
            }),
        );

    const fundAccount = async (address: Address, amount: bigint) => {
        const client = arbitrumPublicClient();
        await client.request({
            method: "anvil_setBalance" as never,
            params: [address, `0x${parseEther("1").toString(16)}`] as never,
        });
        await fundTbtc(client, address, amount);
    };

    // Post-bridge record: on regtest the CCTP legs cannot run, so the engine
    // starts at Locking with the "bridged" amount already on the account.
    const seedLocking = (
        id: string,
        address: string,
        lockSats: number,
    ): DepositRecord => {
        const minted = satsToTokenAmount(lockSats).toString();
        const now = Date.now();
        return {
            id,
            phase: DepositPhase.Locking,
            sourceAsset: "USDC-POL",
            address,
            index: 0,
            createdAt: now,
            updatedAt: now,
            amount: minted,
            txHash: "0xseed",
            logIndex: 0,
            blockNumber: 0,
            burnTxHash: "0xseed",
            guid: "3:0xseed",
            mintedAmount: minted,
        };
    };

    // The EVM pair hash tracks the fork's gas and the liquidity check reads a
    // stale balance cache; both throw transiently out of advanceDeposit (the
    // watcher's retry job in production). Resume from the persisted record.
    const advanceWithRetry = async (
        initial: DepositRecord,
        deps: EngineDeps,
        storage: DepositStorage,
    ): Promise<DepositRecord> => {
        const deadline = Date.now() + 60_000;
        let record = initial;
        for (;;) {
            try {
                return await advanceDeposit(record, deps);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                const retryable =
                    message.includes("invalid pair hash") ||
                    message.includes("insufficient liquidity");
                if (!retryable || Date.now() > deadline) {
                    throw e;
                }
                await sleep(1_000);
                record = (await storage.getDeposit(record.id)) ?? record;
            }
        }
    };

    // The server's L-BTC lockup only confirms with new blocks, which regtest
    // does not produce on its own.
    const withLiquidBlocks = async <T>(fn: () => Promise<T>): Promise<T> => {
        let stopped = false;
        const generator = (async () => {
            while (!stopped) {
                await sleep(2_000);
                await generateLiquidBlock();
            }
        })();
        try {
            return await fn();
        } finally {
            stopped = true;
            await generator;
        }
    };

    test("drives a chain out-swap from Locking to Done and claims to L-BTC", async () => {
        const lockSats = 150_000;
        const account = deriveDepositAccount(MNEMONIC, 10);
        await fundAccount(account.address, satsToTokenAmount(lockSats));
        await refreshBackendBalanceCache("L-BTC");
        const balanceAfterFunding = await tokenBalance(
            arbitrumPublicClient(),
            TBTC_TOKEN_ADDRESS,
            account.address,
        );

        const storage = makeStorage();
        const liquidAddress = await getLiquidAddress();
        const phases: DepositPhase[] = [];
        const deps: EngineDeps = {
            account,
            storage,
            resolveOut: () => ({
                type: "chain",
                to: "L-BTC",
                address: liquidAddress,
            }),
            approveQuote: () => true,
            onEvent: (r) => phases.push(r.phase),
            pollIntervalMs: 1_000,
            runExclusive: (fn) => fn(),
        };
        const record = seedLocking("engine-happy", account.address, lockSats);
        await storage.putDeposit(record);

        const final = await withLiquidBlocks(() =>
            advanceWithRetry(record, deps, storage),
        );

        expect(final.phase).toBe(DepositPhase.Done);
        expect(final.bound).toBe(true);
        expect(final.swapKind).toBe("chain");
        expect(final.claimTxId).toBeTruthy();
        for (const phase of [
            DepositPhase.Creating,
            DepositPhase.AwaitingApproval,
            DepositPhase.Binding,
            DepositPhase.Settling,
            DepositPhase.Done,
        ]) {
            expect(phases).toContain(phase);
        }
        expect(await storage.getDeposit(record.id)).toMatchObject({
            phase: DepositPhase.Done,
        });

        await generateLiquidBlock();
        await waitForTxConfirmed("L-BTC", final.claimTxId as string);
        await waitForAddressUtxos("L-BTC", liquidAddress);
        expect(await elementsGetReceivedByAddress(liquidAddress)).toBe(
            final.receiveAmountSats,
        );
        expect(
            await tokenBalance(
                arbitrumPublicClient(),
                TBTC_TOKEN_ADDRESS,
                account.address,
            ),
        ).toBe(balanceAfterFunding - satsToTokenAmount(lockSats));
    }, 240_000);

    test("refunds the commitment on-chain when the quote is rejected", async () => {
        const lockSats = 120_000;
        const account = deriveDepositAccount(MNEMONIC, 11);
        const minted = satsToTokenAmount(lockSats);
        await fundAccount(account.address, minted);
        await refreshBackendBalanceCache("L-BTC");
        // The fork accumulates refunded TBTC across runs — assert relatively.
        const balanceAfterFunding = await tokenBalance(
            arbitrumPublicClient(),
            TBTC_TOKEN_ADDRESS,
            account.address,
        );

        const storage = makeStorage();
        const liquidAddress = await getLiquidAddress();
        const deps: EngineDeps = {
            account,
            storage,
            resolveOut: () => ({
                type: "chain",
                to: "L-BTC",
                address: liquidAddress,
            }),
            approveQuote: () => false,
            pollIntervalMs: 1_000,
            runExclusive: (fn) => fn(),
        };
        const record = seedLocking("engine-reject", account.address, lockSats);
        await storage.putDeposit(record);

        const final = await advanceWithRetry(record, deps, storage);

        expect(final.phase).toBe(DepositPhase.Failed);
        expect(final.refundTxHash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(final.error).toContain("quote rejected");
        expect(
            await tokenBalance(
                arbitrumPublicClient(),
                TBTC_TOKEN_ADDRESS,
                account.address,
            ),
        ).toBe(balanceAfterFunding);
    }, 240_000);

    test("resumes after a crash without re-locking or re-creating the swap", async () => {
        const lockSats = 150_000;
        const account = deriveDepositAccount(MNEMONIC, 12);
        await fundAccount(account.address, satsToTokenAmount(lockSats));
        await refreshBackendBalanceCache("L-BTC");

        const { contract } = await getCommitmentLockupDetails(ASSET);
        const swapContract = getAddress(contract);
        // `sends` accumulates across the file's tests — count from here.
        const sendsAtStart = sends.length;
        const locksTo = () =>
            sends.slice(sendsAtStart).filter((s) => s.to === swapContract)
                .length;

        const storage = makeStorage();
        const liquidAddress = await getLiquidAddress();
        const record = seedLocking("engine-resume", account.address, lockSats);
        await storage.putDeposit(record);

        // "Crash" right after the quote is created and persisted, before the
        // consumer answers it.
        const controller = new AbortController();
        let commitmentAtCrash: string | undefined;
        const approveBeforeCrash = vi.fn(() => true);
        const deps: EngineDeps = {
            account,
            storage,
            resolveOut: () => ({
                type: "chain",
                to: "L-BTC",
                address: liquidAddress,
            }),
            approveQuote: approveBeforeCrash,
            onEvent: (r) => {
                if (
                    r.phase === DepositPhase.AwaitingApproval &&
                    !controller.signal.aborted
                ) {
                    commitmentAtCrash = r.commitmentTxHash;
                    controller.abort();
                }
            },
            pollIntervalMs: 1_000,
            signal: controller.signal,
            runExclusive: (fn) => fn(),
        };

        await expect(advanceWithRetry(record, deps, storage)).rejects.toThrow(
            "aborted",
        );
        expect(approveBeforeCrash).not.toHaveBeenCalled();

        const stored = await storage.getDeposit(record.id);
        expect(stored?.phase).toBe(DepositPhase.AwaitingApproval);
        expect(stored?.swapId).toBeTruthy();
        expect(stored?.commitmentTxHash).toBe(commitmentAtCrash);
        const locksBefore = locksTo();
        expect(locksBefore).toBe(1);

        const resumeDeps: EngineDeps = {
            ...deps,
            approveQuote: () => true,
            onEvent: undefined,
            signal: undefined,
        };
        const final = await withLiquidBlocks(() =>
            advanceWithRetry(stored as DepositRecord, resumeDeps, storage),
        );

        expect(final.phase).toBe(DepositPhase.Done);
        expect(final.commitmentTxHash).toBe(commitmentAtCrash);
        expect(final.swapId).toBe(stored?.swapId);
        expect(locksTo()).toBe(locksBefore);

        await generateLiquidBlock();
        await waitForTxConfirmed("L-BTC", final.claimTxId as string);
        await waitForAddressUtxos("L-BTC", liquidAddress);
        expect(await elementsGetReceivedByAddress(liquidAddress)).toBe(
            final.receiveAmountSats,
        );
    }, 240_000);

    testSubmarine(
        "settles a Lightning out-swap to a BOLT12 offer",
        async () => {
            const lockSats = 100_000;
            const account = deriveDepositAccount(MNEMONIC, 13);
            await fundAccount(account.address, satsToTokenAmount(lockSats));

            const { offer, offerId } = await clnCreateOffer(
                `deposit-engine-e2e-${Date.now()}`,
            );

            const storage = makeStorage();
            const deps: EngineDeps = {
                account,
                storage,
                resolveOut: () => ({
                    type: "lightning",
                    destination: offer,
                }),
                approveQuote: () => true,
                pollIntervalMs: 1_000,
                runExclusive: (fn) => fn(),
            };
            const record = seedLocking(
                "engine-lightning",
                account.address,
                lockSats,
            );
            await storage.putDeposit(record);

            const final = await advanceWithRetry(record, deps, storage);

            expect(final.phase).toBe(DepositPhase.Done);
            expect(final.swapKind).toBe("submarine");
            // Submarine out has no user claim; the server settles by paying
            // the invoice and claiming the commitment.
            expect(final.claimTxId).toBeUndefined();
            expect(final.receiveAmountSats).toBeGreaterThan(0);

            const { status } = await boltz.swap.status(final.swapId as string);
            expect(isFinalStatus(status)).toBe(true);
            expect(isFailureStatus(status)).toBe(false);
            expect(await clnOfferReceivedSats(offerId)).toBe(
                final.receiveAmountSats,
            );
        },
        240_000,
    );
});
