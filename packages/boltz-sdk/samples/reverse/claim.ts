/**
 * Reverse Swap — Claim (Lightning → BTC on-chain)
 *
 * Flow:
 *   1. Create a reverse swap (Boltz generates a Lightning invoice)
 *   2. Pay the invoice via LND in regtest
 *   3. Boltz locks BTC on-chain
 *   4. Claim the on-chain funds cooperatively via MuSig2
 *
 * Run:
 *   npx tsx packages/boltz-sdk/samples/reverse/claim.ts
 */
import {
    BTC,
    SwapType,
    broadcastTransaction,
    buildClaimTransaction,
    buildReverseClaimContext,
    getPairs,
    getPartialReverseClaimSignature,
    prepareCooperativeSign,
    setupReverseSwap,
    swapStatusPending,
    swapStatusSuccess,
    txToHex,
} from "../../src/index";
import {
    checkConnection,
    generateKeys,
    generatePreimage,
    getBitcoinAddress,
    hex,
    payInvoiceLnd,
    ws,
} from "../helpers";

const main = async () => {
    console.log("📥 Reverse Swap — Claim (Lightning → BTC on-chain)\n");
    await checkConnection();

    const pairs = await getPairs();
    const reversePair = pairs[SwapType.Reverse]?.["BTC"]?.["BTC"];
    if (!reversePair) {
        throw new Error("BTC/BTC reverse pair not available");
    }
    console.log(`Pair hash: ${reversePair.hash}`);
    console.log(`Rate: ${reversePair.rate}`);
    console.log(
        `Limits: ${reversePair.limits.minimal} - ${reversePair.limits.maximal} sats`,
    );

    const claimKeys = generateKeys();
    const { preimage, preimageHash } = generatePreimage();
    const invoiceAmount = reversePair.limits.minimal;
    const claimAddress = await getBitcoinAddress();

    console.log(`Claim public key: ${hex.encode(claimKeys.publicKey)}`);
    console.log(`Preimage hash: ${hex.encode(preimageHash)}`);
    console.log(`Claim address: ${claimAddress}`);

    const swap = await setupReverseSwap(
        BTC,
        BTC,
        invoiceAmount,
        hex.encode(preimageHash),
        hex.encode(preimage),
        reversePair.hash,
        hex.encode(claimKeys.publicKey),
        claimAddress,
    );

    console.log(`\n✅ Swap created: ${swap.id}`);
    console.log(`Invoice: ${swap.invoice.substring(0, 60)}...`);
    console.log(`Lockup address: ${swap.lockupAddress}`);
    console.log(`On-chain amount: ${swap.onchainAmount} sats`);

    console.log("\n⏳ Paying invoice via LND...");
    payInvoiceLnd(swap.invoice).catch(() => {});

    let handled = false;

    ws.on("update", async (update) => {
        if (update.id !== swap.id || handled) return;

        try {
            switch (update.status) {
                case swapStatusPending.TransactionMempool:
                case swapStatusPending.TransactionConfirmed: {
                    handled = true;
                    console.log(`Status: ${update.status}`);

                    const lockupTxHex = update.transaction?.hex;
                    if (!lockupTxHex) {
                        throw new Error(
                            "Lockup transaction hex not in WebSocket update",
                        );
                    }
                    console.log(
                        `Lockup TX received: ${update.transaction?.id}`,
                    );

                    const claimCtx = buildReverseClaimContext(
                        swap,
                        claimKeys,
                        lockupTxHex,
                    );
                    const claimTx = buildClaimTransaction(claimCtx, 300);
                    const session = prepareCooperativeSign(
                        claimCtx,
                        claimTx,
                        0,
                    );

                    const boltzSig = await getPartialReverseClaimSignature(
                        swap.id,
                        preimage,
                        session.publicNonce,
                        txToHex(claimTx),
                        0,
                    );

                    const signedTx = session.finalize(boltzSig);
                    const { id: txId } = await broadcastTransaction(
                        BTC,
                        txToHex(signedTx),
                    );
                    console.log(`🎉 Claim TX broadcast: ${txId}`);
                    break;
                }

                case swapStatusSuccess.InvoiceSettled:
                    console.log(`Final status: ${update.status}`);
                    ws.close();
                    break;
            }
        } catch (e) {
            console.error("Fatal error:", e);
            ws.close();
            process.exit(1);
        }
    });

    ws.subscribe([swap.id]);
};

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});
