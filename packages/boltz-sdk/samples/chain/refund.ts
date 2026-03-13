/**
 * Chain Swap — Refund (L-BTC → BTC, lockup failed)
 *
 * When a chain swap lockup fails (wrong amount sent), the user
 * can reclaim their locked L-BTC cooperatively via MuSig2.
 *
 * Flow:
 *   1. Create a chain swap
 *   2. Send a wrong amount (underpayment) to trigger transaction.lockupFailed
 *   3. Build and sign a cooperative refund transaction
 *   4. Broadcast the refund
 *
 * Run:
 *   npx tsx packages/boltz-sdk/samples/chain/refund.ts
 */
import {
    BTC,
    LBTC,
    SwapType,
    broadcastTransaction,
    buildRefundContext,
    buildRefundTransaction,
    getLockupTransaction,
    getPairs,
    getPartialRefundSignature,
    prepareCooperativeRefund,
    setupChainSwap,
    swapStatusFailed,
    txToHex,
} from "../../src/index";
import {
    checkConnection,
    elementsSendToAddress,
    generateKeys,
    generateLiquidBlock,
    generateLiquidBlocks,
    generatePreimage,
    getLiquidAddress,
    getLiquidBlockHeight,
    hex,
    initLiquid,
    ws,
} from "../helpers";

const main = async () => {
    console.log("🔄 Chain Swap — Refund (L-BTC → BTC, lockup failed)\n");
    await checkConnection();
    await initLiquid();

    const pairs = await getPairs();
    const chainPair = pairs[SwapType.Chain]?.["L-BTC"]?.["BTC"];
    if (!chainPair) {
        throw new Error("L-BTC/BTC chain pair not available");
    }

    const claimKeys = generateKeys();
    const refundKeys = generateKeys();
    const { preimage, preimageHash } = generatePreimage();
    const sendAmount = chainPair.limits.minimal;

    console.log(`Claim public key: ${hex.encode(claimKeys.publicKey)}`);
    console.log(`Refund public key: ${hex.encode(refundKeys.publicKey)}`);

    const swap = await setupChainSwap(
        LBTC,
        BTC,
        sendAmount,
        hex.encode(preimageHash),
        hex.encode(preimage),
        hex.encode(claimKeys.publicKey),
        hex.encode(refundKeys.publicKey),
        chainPair.hash,
    );

    console.log(`\n✅ Swap created: ${swap.id}`);
    console.log(`Lockup (L-BTC) address: ${swap.lockupDetails.lockupAddress}`);
    console.log(`Lockup amount: ${swap.lockupDetails.amount} sats`);

    const underpayAmount = 1000;
    console.log(
        `\n⏳ Sending ${underpayAmount} sats (underpayment, expected ${swap.lockupDetails.amount}) to trigger lockupFailed...`,
    );
    await elementsSendToAddress(
        swap.lockupDetails.lockupAddress,
        underpayAmount,
    );
    await generateLiquidBlock();
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
                        SwapType.Chain,
                    );
                    console.log(`Lockup TX: ${lockup.id}`);
                    console.log(
                        `Timeout block height: ${lockup.timeoutBlockHeight}`,
                    );

                    const refundAddress = await getLiquidAddress();
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
                        SwapType.Chain,
                        session.publicNonce,
                        session.transactionHex,
                        0,
                    );
                    console.log("Boltz partial signature received");

                    const signedTx = session.finalize(boltzSig);
                    console.log("Refund TX signed cooperatively");

                    const currentHeight = await getLiquidBlockHeight();
                    const blocksNeeded =
                        lockup.timeoutBlockHeight - currentHeight;
                    if (blocksNeeded > 0) {
                        console.log(
                            `Mining ${blocksNeeded} Liquid blocks to reach timeout (current: ${currentHeight}, target: ${lockup.timeoutBlockHeight})...`,
                        );
                        await generateLiquidBlocks(blocksNeeded);
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
