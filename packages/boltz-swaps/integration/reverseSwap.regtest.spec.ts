import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import { SwapStatus, isFailureStatus, isFinalStatus } from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";

import {
    BOLTZ_API_URL,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
    getLiquidAddress,
    payInvoiceInBackground,
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

describe("reverse swap integration (regtest)", () => {
    const boltz = createBoltzClient({
        boltzApiUrl: BOLTZ_API_URL,
        network: "regtest",
    });

    const reversePair = async (to: UtxoAssetSym) => {
        const pairs = await getPairs();
        const pair = pairs[SwapType.Reverse]["BTC"]?.[to];
        if (pair?.hash === undefined) {
            throw new Error(`no reverse pair for BTC -> ${to}`);
        }
        return pair;
    };

    const generateBlock = (asset: UtxoAssetSym): Promise<string> =>
        asset === "BTC" ? generateBitcoinBlock() : generateLiquidBlock();

    // The reverse lockup is the server's; the user can claim once it confirms.
    const waitUntilClaimable = async (
        id: string,
        to: UtxoAssetSym,
        timeoutMs: number,
    ): Promise<void> => {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const { status } = await boltz.swap.status(id);
            if (status === SwapStatus.TransactionConfirmed) {
                return;
            }
            if (isFinalStatus(status)) {
                throw new Error(
                    `reverse swap ${id} reached terminal status "${status}" before becoming claimable` +
                        (isFailureStatus(status) ? " (failure)" : ""),
                );
            }
            if (status === SwapStatus.TransactionMempool) {
                await generateBlock(to);
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out after ${timeoutMs}ms waiting for reverse swap ${id} to become claimable (last status "${status}")`,
                );
            }
            await sleep(300);
        }
    };

    const runReverseSwap = async (opts: {
        to: UtxoAssetSym;
        // Larger budget for the heavier uncooperative (script-path) witness.
        feeBudget?: number;
        beforeExecute?: () => Promise<void>;
    }): Promise<void> => {
        const { to } = opts;
        const claimKeys = makeKeys();
        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const claimAddress = await (to === "BTC"
            ? getBitcoinAddress()
            : getLiquidAddress());
        const pair = await reversePair(to);

        const created = await boltz.swap.reverse.create({
            from: "BTC",
            to,
            invoiceAmount: 100_000,
            preimageHash: hex.encode(sha256(preimage)),
            pairHash: pair.hash,
            claimPublicKey: hex.encode(claimKeys.publicKey),
            claimAddress,
        });
        expect(created.id).toBeTruthy();
        expect(created.invoice).toBeTruthy();
        expect(created.onchainAmount).toBeGreaterThan(0);

        // Hold invoice — settles only once our claim reveals the preimage
        payInvoiceInBackground(created.invoice);

        await waitUntilClaimable(created.id, to, 90_000);

        await opts.beforeExecute?.();

        const expectedReceive =
            created.onchainAmount -
            (opts.feeBudget ?? pair.fees.minerFees.claim);

        const result = await boltz.swap.reverse.execute({
            createdSwap: created,
            to,
            preimage: hex.encode(preimage),
            receiveAmount: expectedReceive,
            claimAddress,
            claimKeys,
        });

        expect(result.claimTransactionId).toMatch(/^[0-9a-f]{64}$/);
        expect(result.receiveAmount).toBe(BigInt(expectedReceive));

        await generateBlock(to);
        await waitForTxConfirmed(to, result.claimTransactionId);

        if (to === "BTC") {
            const utxos = await waitForAddressUtxos("BTC", claimAddress);
            const claimed = utxos.find(
                (u) => u.txid === result.claimTransactionId,
            );
            expect(claimed).toBeDefined();
            expect(claimed!.value).toBe(expectedReceive);
        }
    };

    test("LN -> BTC: cooperative reverse claim", async () => {
        await runReverseSwap({ to: "BTC" });
    }, 120_000);

    test("LN -> L-BTC: cooperative reverse claim", async () => {
        await runReverseSwap({ to: "L-BTC" });
    }, 120_000);

    test("LN -> BTC: uncooperative reverse claim when the server refuses to co-sign", async () => {
        try {
            await runReverseSwap({
                to: "BTC",
                feeBudget: 2_000,
                beforeExecute: async () => {
                    await setBackendSignersDisabled(true);
                },
            });
        } finally {
            await setBackendSignersDisabled(false);
        }
    }, 120_000);
});
