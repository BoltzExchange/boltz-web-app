/**
 * Submarine Swap — Refund (BTC on-chain, lockup failed)
 *
 * When a submarine swap lockup fails (wrong amount sent), the user
 * can reclaim their locked BTC cooperatively via MuSig2.
 *
 * Flow:
 *   1. Create a submarine swap
 *   2. Send a wrong amount (underpayment) to trigger transaction.lockupFailed
 *   3. Build and sign a cooperative refund transaction
 *   4. Broadcast the refund
 *
 * Run:
 *   npx tsx packages/boltz-sdk/samples/submarine/refund.ts
 */
import {
    BTC,
    SwapType,
    broadcastTransaction,
    buildRefundContext,
    buildRefundTransaction,
    getLockupTransaction,
    getPairs,
    getPartialRefundSignature,
    prepareCooperativeRefund,
    setupSubmarineSwap,
    swapStatusFailed,
    txToHex,
} from "../../src/index";
import {
    bitcoinSendToAddress,
    checkConnection,
    generateBitcoinBlock,
    generateBitcoinBlocks,
    generateInvoiceLnd,
    generateKeys,
    getBitcoinAddress,
    getBitcoinBlockHeight,
    hex,
    ws,
} from "../helpers";

const main = async () => {
    console.log("🔄 Submarine Swap — Refund (lockup failed)\n");
    await checkConnection();

    const pairs = await getPairs();
    const subPair = pairs[SwapType.Submarine]?.["BTC"]?.["BTC"];
    if (!subPair) {
        throw new Error("BTC/BTC submarine pair not available");
    }

    const invoiceAmountSats = subPair.limits.minimal;
    const invoice = await generateInvoiceLnd(invoiceAmountSats);
    console.log(`Generated invoice for ${invoiceAmountSats} sats`);

    const refundKeys = generateKeys();
    console.log(`Refund public key: ${hex.encode(refundKeys.publicKey)}`);

    const swap = await setupSubmarineSwap(
        BTC,
        BTC,
        invoice,
        subPair.hash,
        hex.encode(refundKeys.publicKey),
    );

    console.log(`\n✅ Swap created: ${swap.id}`);
    console.log(`Lockup address: ${swap.address}`);
    console.log(`Expected amount: ${swap.expectedAmount} sats`);

    const underpayAmount = 1000;
    console.log(
        `\n⏳ Sending ${underpayAmount} sats (underpayment, expected ${swap.expectedAmount}) to trigger lockupFailed...`,
    );
    await bitcoinSendToAddress(swap.address, underpayAmount);
    await generateBitcoinBlock();
    console.log("Underpayment sent and block mined");

    let handled = false;

    ws.on("update", async (update) => {
        if (update.id !== swap.id || handled) return;

        try {
            switch (update.status) {
                case swapStatusFailed.TransactionLockupFailed: {
                    handled = true;
                    console.log(`Status: ${update.status}`);

                    const lockup = await getLockupTransaction(
                        swap.id,
                        SwapType.Submarine,
                    );
                    console.log(`Lockup TX: ${lockup.id}`);
                    console.log(
                        `Timeout block height: ${lockup.timeoutBlockHeight}`,
                    );

                    const refundAddress = await getBitcoinAddress();
                    const refundCtx = buildRefundContext(
                        swap,
                        refundKeys,
                        refundAddress,
                        [lockup.hex],
                    );
                    console.log(
                        `Refund context built for asset: ${refundCtx.asset}`,
                    );

                    const refundTx = buildRefundTransaction(
                        refundCtx,
                        lockup.timeoutBlockHeight,
                        2,
                    );
                    console.log("Unsigned refund TX built");

                    const session = prepareCooperativeRefund(
                        refundCtx,
                        refundTx,
                        0,
                    );
                    console.log("MuSig2 nonce generated");

                    const boltzSig = await getPartialRefundSignature(
                        swap.id,
                        SwapType.Submarine,
                        session.publicNonce,
                        session.transactionHex,
                        0,
                    );
                    console.log("Boltz partial signature received");

                    const signedTx = session.finalize(boltzSig);
                    console.log("Refund TX signed cooperatively");

                    const currentHeight = await getBitcoinBlockHeight();
                    const blocksNeeded =
                        lockup.timeoutBlockHeight - currentHeight;
                    if (blocksNeeded > 0) {
                        console.log(
                            `Mining ${blocksNeeded} blocks to reach timeout (current: ${currentHeight}, target: ${lockup.timeoutBlockHeight})...`,
                        );
                        await generateBitcoinBlocks(blocksNeeded);
                    }

                    const { id: txId } = await broadcastTransaction(
                        swap.assetSend,
                        txToHex(signedTx),
                    );
                    console.log(`🎉 Refund TX broadcast: ${txId}`);
                    ws.close();
                    break;
                }
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
