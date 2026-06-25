import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import {
    broadcastApiTransaction,
    getLockupTransaction,
} from "boltz-swaps/client";
import {
    SwapStatus,
    isFailureStatus,
    isSuccessStatus,
} from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";

import {
    BOLTZ_API_URL,
    addInvoiceLnd,
    allowSwapRefund,
    bitcoinSendToAddress,
    cancelInvoiceLnd,
    elementsSendToAddress,
    generateBitcoinBlock,
    generateBlocks,
    generateLiquidBlock,
    getBitcoinAddress,
    getBlockCount,
    getLiquidAddress,
    satsToCoins,
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

describe("submarine swap integration (regtest)", () => {
    const boltz = createBoltzClient({
        boltzApiUrl: BOLTZ_API_URL,
        network: "regtest",
    });

    const submarinePair = async (from: UtxoAssetSym) => {
        const pairs = await getPairs();
        const pair = pairs[SwapType.Submarine][from]?.["BTC"];
        if (pair?.hash === undefined) {
            throw new Error(`no submarine pair for ${from} -> LN`);
        }
        return pair;
    };

    const generateBlock = (asset: UtxoAssetSym): Promise<string> =>
        asset === "BTC" ? generateBitcoinBlock() : generateLiquidBlock();

    const fundLockup = (
        asset: UtxoAssetSym,
        address: string,
        sats: number,
    ): Promise<string> =>
        asset === "BTC"
            ? bitcoinSendToAddress(address, satsToCoins(sats))
            : elementsSendToAddress(address, satsToCoins(sats));

    const runSubmarineClaim = async (from: UtxoAssetSym): Promise<void> => {
        const refundKeys = makeKeys();
        const { invoice } = await addInvoiceLnd(100_000);
        const pair = await submarinePair(from);

        const created = await boltz.swap.submarine.create({
            from,
            to: "BTC",
            invoice,
            pairHash: pair.hash,
            refundPublicKey: hex.encode(refundKeys.publicKey),
        });
        expect(created.id).toBeTruthy();
        expect(created.address).toBeTruthy();
        expect(created.expectedAmount).toBeGreaterThan(0);

        await fundLockup(from, created.address, created.expectedAmount);
        await generateBlock(from);

        let cosigned = false;
        const deadline = Date.now() + 90_000;
        for (;;) {
            const { status } = await boltz.swap.status(created.id);
            if (isSuccessStatus(status)) {
                break;
            }
            if (isFailureStatus(status)) {
                throw new Error(
                    `submarine swap ${created.id} failed with status "${status}"`,
                );
            }
            if (status === SwapStatus.TransactionMempool) {
                await generateBlock(from);
            } else if (
                status === SwapStatus.TransactionClaimPending &&
                !cosigned
            ) {
                await boltz.swap.submarine.signClaim({
                    id: created.id,
                    asset: from,
                    swapTree: created.swapTree,
                    claimPublicKey: created.claimPublicKey,
                    refundKeys,
                    invoice,
                });
                cosigned = true;
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out waiting for submarine swap ${created.id} to settle (last status "${status}")`,
                );
            }
            await sleep(300);
        }

        expect(cosigned).toBe(true);
    };

    test("BTC -> LN: cooperative submarine claim", async () => {
        await runSubmarineClaim("BTC");
    }, 120_000);

    test("L-BTC -> LN: cooperative submarine claim", async () => {
        await runSubmarineClaim("L-BTC");
    }, 120_000);

    const runSubmarineRefund = async (from: UtxoAssetSym): Promise<void> => {
        const refundKeys = makeKeys();
        const { invoice, paymentHash } = await addInvoiceLnd(100_000);
        await cancelInvoiceLnd(paymentHash);
        const pair = await submarinePair(from);

        const created = await boltz.swap.submarine.create({
            from,
            to: "BTC",
            invoice,
            pairHash: pair.hash,
            refundPublicKey: hex.encode(refundKeys.publicKey),
        });

        await fundLockup(from, created.address, created.expectedAmount);
        await generateBlock(from);

        const deadline = Date.now() + 90_000;
        for (;;) {
            const { status } = await boltz.swap.status(created.id);
            if (status === SwapStatus.InvoiceFailedToPay) {
                break;
            }
            if (isSuccessStatus(status)) {
                throw new Error("submarine swap unexpectedly claimed");
            }
            if (status === SwapStatus.TransactionMempool) {
                await generateBlock(from);
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out waiting for invoice.failedToPay (last status "${status}")`,
                );
            }
            await sleep(300);
        }

        // Skips the timeout safety check so Boltz co-signs the refund now
        await allowSwapRefund(created.id);

        const lockup = await getLockupTransaction(
            created.id,
            SwapType.Submarine,
        );
        const refundAddress = await (from === "BTC"
            ? getBitcoinAddress()
            : getLiquidAddress());

        const refund = await boltz.swap.submarine.refundUtxo({
            id: created.id,
            asset: from,
            swapTree: created.swapTree,
            claimPublicKey: created.claimPublicKey,
            refundKeys,
            lockupTxHex: lockup.hex,
            refundAddress,
            blindingKey: created.blindingKey,
            feePerVbyte: 2,
            timeoutBlockHeight: created.timeoutBlockHeight,
        });
        expect(refund.transactionId).toMatch(/^[0-9a-f]{64}$/);

        await broadcastApiTransaction(from, refund.transactionHex);
        await generateBlock(from);
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

    test("BTC -> LN: cooperative refund after the invoice fails", async () => {
        await runSubmarineRefund("BTC");
    }, 120_000);

    test("L-BTC -> LN: cooperative refund after the invoice fails", async () => {
        await runSubmarineRefund("L-BTC");
    }, 120_000);

    const runSubmarineRefundUncooperative = async (
        from: UtxoAssetSym,
    ): Promise<void> => {
        const refundKeys = makeKeys();
        const { invoice, paymentHash } = await addInvoiceLnd(100_000);
        await cancelInvoiceLnd(paymentHash);
        const pair = await submarinePair(from);

        const created = await boltz.swap.submarine.create({
            from,
            to: "BTC",
            invoice,
            pairHash: pair.hash,
            refundPublicKey: hex.encode(refundKeys.publicKey),
        });

        await fundLockup(from, created.address, created.expectedAmount);
        await generateBlock(from);

        const deadline = Date.now() + 90_000;
        for (;;) {
            const { status } = await boltz.swap.status(created.id);
            if (status === SwapStatus.InvoiceFailedToPay) {
                break;
            }
            if (isSuccessStatus(status)) {
                throw new Error("submarine swap unexpectedly claimed");
            }
            if (status === SwapStatus.TransactionMempool) {
                await generateBlock(from);
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out waiting for invoice.failedToPay (last status "${status}")`,
                );
            }
            await sleep(300);
        }

        const lockup = await getLockupTransaction(
            created.id,
            SwapType.Submarine,
        );
        const refundAddress = await (from === "BTC"
            ? getBitcoinAddress()
            : getLiquidAddress());

        // Mine past the swap timeout so the timelocked (script-path) refund,
        // which Boltz never co-signs, becomes final and broadcastable.
        const height = await getBlockCount(from);
        if (height <= created.timeoutBlockHeight) {
            await generateBlocks(from, created.timeoutBlockHeight - height + 1);
        }

        const refund = await boltz.swap.submarine.refundUtxo({
            id: created.id,
            asset: from,
            swapTree: created.swapTree,
            claimPublicKey: created.claimPublicKey,
            refundKeys,
            lockupTxHex: lockup.hex,
            refundAddress,
            blindingKey: created.blindingKey,
            feePerVbyte: 2,
            timeoutBlockHeight: created.timeoutBlockHeight,
            cooperative: false,
        });
        expect(refund.transactionId).toMatch(/^[0-9a-f]{64}$/);

        await broadcastApiTransaction(from, refund.transactionHex);
        await generateBlock(from);
        await waitForTxConfirmed(from, refund.transactionId);

        if (from === "BTC") {
            const utxos = await waitForAddressUtxos("BTC", refundAddress);
            expect(
                utxos.find((u) => u.txid === refund.transactionId),
            ).toBeDefined();
        }
    };

    test("BTC -> LN: uncooperative timelocked refund after the timeout", async () => {
        await runSubmarineRefundUncooperative("BTC");
    }, 180_000);
});
