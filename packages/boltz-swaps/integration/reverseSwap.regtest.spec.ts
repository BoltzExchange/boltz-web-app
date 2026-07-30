import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import { SwapStatus, isFailureStatus, isFinalStatus } from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";

import { liquidUnconfidentialClaimExtra } from "../src/utxo/claim.ts";
import {
    BOLTZ_API_URL,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
    getEsploraTransaction,
    getLiquidAddress,
    getLiquidUnconfidentialAddress,
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

    describe("LN -> L-BTC: claim to an unconfidential address", () => {
        const setUpClaim = async () => {
            const claimKeys = makeKeys();
            const preimage = crypto.getRandomValues(new Uint8Array(32));
            const claimAddress = await getLiquidUnconfidentialAddress();
            expect(claimAddress.startsWith("ert1")).toBe(true);

            const pair = await reversePair("L-BTC");
            const created = await boltz.swap.reverse.create({
                from: "BTC",
                to: "L-BTC",
                invoiceAmount: 100_000,
                preimageHash: hex.encode(sha256(preimage)),
                pairHash: pair.hash,
                claimPublicKey: hex.encode(claimKeys.publicKey),
                claimAddress,
            });

            payInvoiceInBackground(created.invoice);
            await waitUntilClaimable(created.id, "L-BTC", 90_000);

            return {
                claimKeys,
                claimAddress,
                created,
                claimFee: pair.fees.minerFees.claim,
                execute: (receiveAmount: number) =>
                    boltz.swap.reverse.execute({
                        createdSwap: created,
                        to: "L-BTC",
                        preimage: hex.encode(preimage),
                        receiveAmount,
                        claimAddress,
                        claimKeys,
                    }),
            };
        };

        test("is accepted by Elements and pays the surcharge out of the claim output", async () => {
            const { created, claimAddress, claimFee, execute } =
                await setUpClaim();
            const receiveAmount = created.onchainAmount - claimFee;

            const result = await execute(receiveAmount);
            expect(result.claimTransactionId).toMatch(/^[0-9a-f]{64}$/);

            await generateLiquidBlock();
            await waitForTxConfirmed("L-BTC", result.claimTransactionId);

            const utxos = await waitForAddressUtxos("L-BTC", claimAddress);
            const claimed = utxos.find(
                (utxo) => utxo.txid === result.claimTransactionId,
            );
            expect(claimed).toBeDefined();
            expect(claimed!.value).toBe(
                receiveAmount - liquidUnconfidentialClaimExtra,
            );
            expect(result.receiveAmount).toBe(BigInt(claimed!.value));

            const tx = await getEsploraTransaction(
                "L-BTC",
                result.claimTransactionId,
            );
            expect(tx.vout).toHaveLength(3);
            expect(
                tx.vout.filter((out) => out.scriptpubkey_type === "op_return"),
            ).toHaveLength(1);
            expect(tx.fee).toBe(claimFee + liquidUnconfidentialClaimExtra - 1);
        }, 120_000);

        // Shrinking the budget by the surcharge cancels it out, reproducing the
        // pre-fix fee. Guards the test above against passing for free.
        test("would be rejected without the surcharge", async () => {
            const { created, claimFee, execute } = await setUpClaim();
            const receiveAmount =
                created.onchainAmount -
                claimFee +
                liquidUnconfidentialClaimExtra;

            await expect(execute(receiveAmount)).rejects.toThrow(
                /min relay fee not met/i,
            );
        }, 120_000);
    });

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
