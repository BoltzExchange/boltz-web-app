import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import {
    broadcastApiTransaction,
    getLockupTransaction,
} from "boltz-swaps/client";
import {
    SwapStatus,
    isChainSwapClaimable,
    isFailureStatus,
    isFinalStatus,
} from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";
import { refundUtxos } from "boltz-swaps/utxo";

import {
    BOLTZ_API_URL,
    bitcoinSendToAddress,
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
    getLiquidAddress,
    satsToCoins,
    setBackendSignersDisabled,
    sleep,
    waitForAddressUtxos,
    waitForTxConfirmed,
} from "./regtest.ts";

type UtxoAssetSym = "BTC" | "L-BTC";
type ECKeys = { privateKey: Uint8Array; publicKey: Uint8Array };

const makeKeys = (): ECKeys => {
    const privateKey = secp256k1.utils.randomSecretKey();
    return { privateKey, publicKey: secp256k1.getPublicKey(privateKey, true) };
};

describe("chain swap integration (regtest)", () => {
    const boltz = createBoltzClient({
        boltzApiUrl: BOLTZ_API_URL,
        network: "regtest",
    });

    const chainPair = async (from: UtxoAssetSym, to: UtxoAssetSym) => {
        const pairs = await getPairs();
        const pair = pairs[SwapType.Chain][from]?.[to];
        if (pair?.hash === undefined) {
            throw new Error(`no chain pair for ${from} -> ${to}`);
        }
        return pair;
    };

    const waitUntilClaimable = async (
        id: string,
        from: UtxoAssetSym,
        to: UtxoAssetSym,
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
                    `swap ${id} reached terminal status "${status}" before becoming claimable` +
                        (isFailureStatus(status) ? " (failure)" : ""),
                );
            }
            if (status === SwapStatus.TransactionMempool) {
                await (from === "BTC"
                    ? generateBitcoinBlock()
                    : generateLiquidBlock());
            } else if (status === SwapStatus.TransactionServerMempool) {
                await (to === "BTC"
                    ? generateBitcoinBlock()
                    : generateLiquidBlock());
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out after ${timeoutMs}ms waiting for swap ${id} to become claimable (last status "${status}")`,
                );
            }
            await sleep(300);
        }
    };

    const runChainSwap = async (opts: {
        from: UtxoAssetSym;
        to: UtxoAssetSym;
        feeBudget?: number;
        beforeClaim?: () => Promise<void>;
    }): Promise<void> => {
        const { from, to } = opts;
        const claimKeys = makeKeys();
        const refundKeys = makeKeys();
        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const claimAddress = await (to === "BTC"
            ? getBitcoinAddress()
            : getLiquidAddress());
        const pair = await chainPair(from, to);

        const created = await boltz.swap.chain.create({
            from,
            to,
            userLockAmount: 200_000,
            preimageHash: hex.encode(sha256(preimage)),
            claimPublicKey: hex.encode(claimKeys.publicKey),
            refundPublicKey: hex.encode(refundKeys.publicKey),
            pairHash: pair.hash,
        });
        expect(created.id).toBeTruthy();
        expect(created.claimDetails.amount).toBeGreaterThan(0);

        const lockupAddress = created.lockupDetails.lockupAddress;
        const lockupCoins = satsToCoins(created.lockupDetails.amount);
        await (from === "BTC"
            ? bitcoinSendToAddress(lockupAddress, lockupCoins)
            : elementsSendToAddress(lockupAddress, lockupCoins));
        await (from === "BTC" ? generateBitcoinBlock() : generateLiquidBlock());

        await waitUntilClaimable(created.id, from, to, 90_000);

        await opts.beforeClaim?.();

        const feeBudget = opts.feeBudget ?? pair.fees.minerFees.user.claim;
        const expectedReceive = created.claimDetails.amount - feeBudget;

        const result = await boltz.swap.chain.execute({
            createdSwap: created,
            to,
            preimage: hex.encode(preimage),
            claimAddress,
            utxoClaim: {
                claimKeys,
                receiveAmount: expectedReceive,
                cooperativeSource: { asset: from, refundKeys },
            },
        });

        expect(result.claimTransactionId).toMatch(/^[0-9a-f]{64}$/);
        expect(result.receiveAmount).toBe(BigInt(expectedReceive));

        await (to === "BTC" ? generateBitcoinBlock() : generateLiquidBlock());
        await waitForTxConfirmed(to, result.claimTransactionId);

        if (to === "BTC") {
            const utxos = await waitForAddressUtxos("BTC", claimAddress);
            const claimed = utxos.find(
                (u) => u.txid === result.claimTransactionId,
            );
            expect(claimed).toBeDefined();
            expect(claimed!.value).toBeGreaterThanOrEqual(expectedReceive);
            expect(claimed!.value).toBeLessThanOrEqual(
                created.claimDetails.amount,
            );
        }
    };

    test("L-BTC -> BTC: cooperative claim (transparent destination)", async () => {
        await runChainSwap({ from: "L-BTC", to: "BTC" });
    }, 120_000);

    test("BTC -> L-BTC: cooperative claim (confidential destination)", async () => {
        await runChainSwap({ from: "BTC", to: "L-BTC" });
    }, 120_000);

    test("L-BTC -> BTC: uncooperative script-path claim when the server refuses to co-sign", async () => {
        try {
            await runChainSwap({
                from: "L-BTC",
                to: "BTC",
                feeBudget: 1_000,
                beforeClaim: async () => {
                    await setBackendSignersDisabled(true);
                },
            });
        } finally {
            await setBackendSignersDisabled(false);
        }
    }, 120_000);

    test("reports a failure status for a below-minimum lockup", async () => {
        const claimKeys = makeKeys();
        const refundKeys = makeKeys();
        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const pair = await chainPair("L-BTC", "BTC");

        const created = await boltz.swap.chain.create({
            from: "L-BTC",
            to: "BTC",
            userLockAmount: 200_000,
            preimageHash: hex.encode(sha256(preimage)),
            claimPublicKey: hex.encode(claimKeys.publicKey),
            refundPublicKey: hex.encode(refundKeys.publicKey),
            pairHash: pair.hash,
        });

        await elementsSendToAddress(
            created.lockupDetails.lockupAddress,
            satsToCoins(1_000),
        );
        await generateLiquidBlock();

        const deadline = Date.now() + 60_000;
        let { status } = await boltz.swap.status(created.id);
        while (!isFinalStatus(status)) {
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out waiting for failure status (last "${status}")`,
                );
            }
            await generateLiquidBlock();
            await sleep(300);
            ({ status } = await boltz.swap.status(created.id));
        }

        expect(status).toBe(SwapStatus.TransactionLockupFailed);
        expect(isFailureStatus(status)).toBe(true);
    }, 120_000);

    const runChainRefund = async (
        from: UtxoAssetSym,
        to: UtxoAssetSym,
    ): Promise<void> => {
        const claimKeys = makeKeys();
        const refundKeys = makeKeys();
        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const pair = await chainPair(from, to);

        const created = await boltz.swap.chain.create({
            from,
            to,
            userLockAmount: 200_000,
            preimageHash: hex.encode(sha256(preimage)),
            claimPublicKey: hex.encode(claimKeys.publicKey),
            refundPublicKey: hex.encode(refundKeys.publicKey),
            pairHash: pair.hash,
        });
        expect(created.id).toBeTruthy();

        // Underpay the lockup: the swap fails (TransactionLockupFailed) and the
        // server never locks, which is exactly when Boltz cooperatively
        // co-signs a chain refund. 20_000 stays well above the dust limit.
        await (from === "BTC"
            ? bitcoinSendToAddress(
                  created.lockupDetails.lockupAddress,
                  satsToCoins(20_000),
              )
            : elementsSendToAddress(
                  created.lockupDetails.lockupAddress,
                  satsToCoins(20_000),
              ));
        await (from === "BTC" ? generateBitcoinBlock() : generateLiquidBlock());

        const deadline = Date.now() + 90_000;
        let { status } = await boltz.swap.status(created.id);
        while (status !== SwapStatus.TransactionLockupFailed) {
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out waiting for TransactionLockupFailed (last "${status}")`,
                );
            }
            await (from === "BTC"
                ? generateBitcoinBlock()
                : generateLiquidBlock());
            await sleep(300);
            ({ status } = await boltz.swap.status(created.id));
        }

        const lockupHex = (
            await getLockupTransaction(created.id, SwapType.Chain)
        ).hex;
        expect(lockupHex).toBeTruthy();

        const refundAddress = await (from === "BTC"
            ? getBitcoinAddress()
            : getLiquidAddress());

        const refund = await refundUtxos({
            id: created.id,
            swapType: SwapType.Chain,
            asset: from,
            network: "regtest",
            swapTree: created.lockupDetails.swapTree,
            claimPublicKey: created.lockupDetails.serverPublicKey,
            refundKeys,
            lockups: [
                {
                    lockupTxHex: lockupHex,
                    timeoutBlockHeight:
                        created.lockupDetails.timeoutBlockHeight,
                },
            ],
            refundAddress,
            blindingKey: created.lockupDetails.blindingKey,
            feePerVbyte: 2,
            nLockTime: created.lockupDetails.timeoutBlockHeight,
            cooperative: true,
        });
        expect(refund.cooperativeError).toBeUndefined();
        expect(refund.transactionId).toMatch(/^[0-9a-f]{64}$/);

        await broadcastApiTransaction(from, refund.transactionHex);
        await (from === "BTC" ? generateBitcoinBlock() : generateLiquidBlock());
        await waitForTxConfirmed(from, refund.transactionId);

        // Esplora UTXO-by-address lookup only works for transparent BTC, not
        // the L-BTC confidential address (covered by the confirmed tx above)
        if (from === "BTC") {
            const utxos = await waitForAddressUtxos("BTC", refundAddress);
            expect(
                utxos.find((u) => u.txid === refund.transactionId),
            ).toBeDefined();
        }
    };

    test("L-BTC -> BTC: cooperative chain refund of the user lockup", async () => {
        await runChainRefund("L-BTC", "BTC");
    }, 120_000);

    test("BTC -> L-BTC: cooperative chain refund of the user lockup", async () => {
        await runChainRefund("BTC", "L-BTC");
    }, 120_000);
});
