import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import {
    SwapStatus,
    isChainSwapClaimable,
    isFinalStatus,
} from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";

import {
    ARBITRUM_RPC_URL,
    GAS_SPONSOR_URL,
    TBTC_TOKEN_ADDRESS,
    arbitrumPublicClient,
    ensureBackendTbtcLiquidity,
    isArbitrumForkReachable,
    makeArbitrumSigner,
    tokenBalance,
} from "./arbitrum.ts";
import {
    BOLTZ_API_URL,
    elementsSendToAddress,
    generateLiquidBlock,
    refreshBackendBalanceCache,
    satsToCoins,
    sleep,
} from "./regtest.ts";

type ECKeys = { privateKey: Uint8Array; publicKey: Uint8Array };

const makeKeys = (): ECKeys => {
    const privateKey = secp256k1.utils.randomSecretKey();
    return { privateKey, publicKey: secp256k1.getPublicKey(privateKey, true) };
};

// The EVM pair's fee tracks the fork's gas and the backend refreshes the pair
// hash on its own interval, so a hash can go stale between fetch and create
// ("invalid pair hash"). Retry with a freshly-fetched hash until it settles.
const createWithFreshPair = async <T>(
    build: (pairHash: string) => Promise<T>,
): Promise<T> => {
    const deadline = Date.now() + 30_000;
    for (;;) {
        const pairs = await getPairs();
        const pair = pairs[SwapType.Chain]["L-BTC"]?.["TBTC"];
        if (pair?.hash === undefined) {
            throw new Error("no L-BTC -> TBTC chain pair");
        }
        try {
            return await build(pair.hash);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (
                !message.includes("invalid pair hash") ||
                Date.now() > deadline
            ) {
                throw e;
            }
            await sleep(1_000);
        }
    }
};

// Needs the anvil Arbitrum fork + gas-sponsor emulator (webapp-ci/stables-e2e profiles); skip otherwise.
const forkReachable = await isArbitrumForkReachable();
const describeFork = forkReachable ? describe : describe.skip;

describeFork("Arbitrum chain swap integration (regtest)", () => {
    // mainnet preset (real contract addresses) pointed at the local anvil fork; mirrors web app regtest config.
    const arbitrumConfig = buildMainnetConfig({
        filterAssets: (asset) =>
            asset === "BTC" ||
            asset === "L-BTC" ||
            asset === "TBTC" ||
            asset === "USDT0",
        rpcUrls: { ARB: [ARBITRUM_RPC_URL] },
    });

    const boltz = createBoltzClient({
        ...arbitrumConfig,
        boltzApiUrl: BOLTZ_API_URL,
        network: "regtest",
        gasSponsor: GAS_SPONSOR_URL,
    });

    const waitUntilClaimable = async (
        id: string,
        timeoutMs: number,
    ): Promise<void> => {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const { status } = await boltz.swap.status(id);
            if (isChainSwapClaimable({ status })) {
                return;
            }
            if (isFinalStatus(status)) {
                throw new Error(
                    `chain swap ${id} reached terminal status "${status}" before becoming claimable`,
                );
            }
            // Only the L-BTC user lockup needs blocks; the server's TBTC lockup confirms on the fork automatically.
            if (status === SwapStatus.TransactionMempool) {
                await generateLiquidBlock();
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out waiting for chain swap ${id} to become claimable (last status "${status}")`,
                );
            }
            await sleep(500);
        }
    };

    test("claims an L-BTC -> TBTC chain swap to an EVM address", async () => {
        const publicClient = arbitrumPublicClient();
        await ensureBackendTbtcLiquidity(publicClient);

        const signer = makeArbitrumSigner();
        const refundKeys = makeKeys();
        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const userLockAmount = 200_000;

        // TBTC is funded above, but the backend's liquidity check reads a cache
        // that only refreshes every ~15s. Force it to pick up the live balance
        // now so create can't lose the race to "insufficient liquidity".
        await refreshBackendBalanceCache("TBTC");

        const created = await createWithFreshPair((pairHash) =>
            boltz.swap.chain.create({
                from: "L-BTC",
                to: "TBTC",
                userLockAmount,
                preimageHash: hex.encode(sha256(preimage)),
                refundPublicKey: hex.encode(refundKeys.publicKey),
                claimAddress: signer.address,
                pairHash,
            }),
        );
        expect(created.id).toBeTruthy();
        expect(created.claimDetails.amount).toBeGreaterThan(0);

        const balanceBefore = await tokenBalance(
            publicClient,
            TBTC_TOKEN_ADDRESS,
            signer.address,
        );

        await elementsSendToAddress(
            created.lockupDetails.lockupAddress,
            satsToCoins(created.lockupDetails.amount),
        );
        await generateLiquidBlock();

        await waitUntilClaimable(created.id, 90_000);

        // EVM claim through the gas sponsor (EIP-7702); the signer needs no ETH.
        const result = await boltz.swap.chain.execute({
            createdSwap: created,
            to: "TBTC",
            preimage: hex.encode(preimage),
            claimAddress: signer.address,
            signer,
        });
        expect(result.claimTransactionId).toMatch(/^0x[0-9a-f]{64}$/);

        const balanceAfter = await tokenBalance(
            publicClient,
            TBTC_TOKEN_ADDRESS,
            signer.address,
        );
        expect(balanceAfter).toBeGreaterThan(balanceBefore);
        expect(balanceAfter - balanceBefore).toBe(result.receiveAmount);
    }, 150_000);
});
