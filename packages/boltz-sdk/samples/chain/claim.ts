/**
 * Chain Swap — Claim (L-BTC → BTC, on-chain to on-chain)
 *
 * Flow:
 *   1. Create a chain swap (L-BTC → BTC)
 *   2. Send L-BTC to the lockup address + mine a Liquid block
 *   3. Boltz locks BTC on the destination chain
 *   4. Co-sign the server's claim on the lockup (L-BTC) side
 *   5. Build and sign our claim on the destination (BTC) side
 *   6. Post both signatures to Boltz, finalize, and broadcast
 *
 * Run:
 *   npx tsx packages/boltz-sdk/samples/chain/claim.ts
 */
import {
    BTC,
    LBTC,
    SwapType,
    broadcastTransaction,
    buildChainClaimContext,
    buildClaimTransaction,
    createChainSwapServerClaimSignature,
    getChainSwapClaimDetails,
    getChainSwapTransactions,
    getPairs,
    postChainSwapDetails,
    prepareCooperativeSign,
    setupChainSwap,
    swapStatusPending,
    txToHex,
} from "../../src/index";
import {
    checkConnection,
    elementsSendToAddress,
    generateKeys,
    generateLiquidBlock,
    generatePreimage,
    hex,
    ws,
} from "../helpers";

const main = async () => {
    console.log("🔗 Chain Swap — Claim (L-BTC → BTC)\n");
    await checkConnection();

    const pairs = await getPairs();
    const chainPair = pairs[SwapType.Chain]?.["L-BTC"]?.["BTC"];
    if (!chainPair) {
        throw new Error("L-BTC/BTC chain pair not available");
    }
    console.log(`Pair hash: ${chainPair.hash}`);
    console.log(
        `Limits: ${chainPair.limits.minimal} - ${chainPair.limits.maximal} sats`,
    );

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
    if (swap.lockupDetails.bip21) {
        console.log(`BIP-21: ${swap.lockupDetails.bip21}`);
    }

    console.log(
        `\n⏳ Sending ${swap.lockupDetails.amount} L-BTC sats to lockup address...`,
    );
    await elementsSendToAddress(
        swap.lockupDetails.lockupAddress,
        swap.lockupDetails.amount,
    );
    await generateLiquidBlock();
    console.log("Funds sent and block mined");

    console.log("Waiting for server lockup on BTC side...");

    let handled = false;

    ws.on("update", async (update) => {
        if (update.id !== swap.id || handled) return;

        try {
            switch (update.status) {
                case swapStatusPending.TransactionServerMempool:
                case swapStatusPending.TransactionServerConfirmed: {
                    handled = true;
                    console.log(`Status: ${update.status}`);

                    const txs = await getChainSwapTransactions(swap.id);
                    console.log(
                        `User lockup TX: ${txs.userLock.transaction.id}`,
                    );
                    console.log(
                        `Server lockup TX: ${txs.serverLock.transaction.id}`,
                    );

                    const serverLockupHex = txs.serverLock.transaction.hex;
                    if (!serverLockupHex) {
                        throw new Error(
                            "Server lockup transaction hex not available",
                        );
                    }

                    const serverClaimDetails = await getChainSwapClaimDetails(
                        swap.id,
                    );
                    const serverClaimSig = createChainSwapServerClaimSignature(
                        swap,
                        refundKeys,
                        serverClaimDetails,
                    );
                    console.log("Server claim co-signature created");

                    const claimCtx = buildChainClaimContext(
                        swap,
                        claimKeys,
                        serverLockupHex,
                    );
                    const claimTx = buildClaimTransaction(claimCtx, 300);
                    const session = prepareCooperativeSign(
                        claimCtx,
                        claimTx,
                        0,
                    );

                    const boltzResponse = await postChainSwapDetails(
                        swap.id,
                        hex.encode(preimage),
                        serverClaimSig,
                        {
                            pubNonce: hex.encode(session.publicNonce),
                            transaction: txToHex(claimTx),
                            index: 0,
                        },
                    );
                    console.log("Boltz co-signed our claim transaction");

                    const signedClaimTx = session.finalize({
                        pubNonce: hex.decode(boltzResponse.pubNonce),
                        signature: hex.decode(boltzResponse.partialSignature),
                    });

                    const { id: claimTxId } = await broadcastTransaction(
                        BTC,
                        txToHex(signedClaimTx),
                    );
                    console.log(`🎉 Claim TX broadcast: ${claimTxId}`);
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
