/**
 * Submarine Swap — Claim (BTC on-chain → Lightning)
 *
 * In a submarine swap, the *user* sends on-chain and Boltz pays a Lightning
 * invoice. After Boltz settles the invoice, the user co-signs Boltz's
 * on-chain claim transaction cooperatively.
 *
 * Flow:
 *   1. Generate a BOLT-11 invoice via LND in regtest
 *   2. Create a submarine swap with that invoice
 *   3. Send BTC to the lockup address + mine a block
 *   4. Boltz pays the Lightning invoice
 *   5. Co-sign Boltz's claim transaction via MuSig2
 *
 * Run:
 *   npx tsx packages/boltz-sdk/samples/submarine/claim.ts
 */
import {
    BTC,
    SwapType,
    createSubmarineClaimSignature,
    getPairs,
    getSubmarineClaimDetails,
    postSubmarineClaimDetails,
    setupSubmarineSwap,
    swapStatusPending,
} from "../../src/index";
import {
    bitcoinSendToAddress,
    checkConnection,
    generateBitcoinBlock,
    generateInvoiceLnd,
    generateKeys,
    hex,
    ws,
} from "../helpers";

const main = async () => {
    console.log("📤 Submarine Swap — Claim (BTC on-chain → Lightning)\n");
    await checkConnection();

    const pairs = await getPairs();
    const subPair = pairs[SwapType.Submarine]?.["BTC"]?.["BTC"];
    if (!subPair) {
        throw new Error("BTC/BTC submarine pair not available");
    }
    console.log(`Pair hash: ${subPair.hash}`);
    console.log(
        `Fee: ${subPair.fees.percentage}% + ${subPair.fees.minerFees} sats miner fee`,
    );

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
    console.log(`BIP-21: ${swap.bip21}`);
    console.log(`Expected amount: ${swap.expectedAmount} sats`);

    console.log(
        `\n⏳ Sending ${swap.expectedAmount} sats to lockup address...`,
    );
    await bitcoinSendToAddress(swap.address, swap.expectedAmount);
    await generateBitcoinBlock();
    console.log("Funds sent and block mined");

    console.log("Waiting for Boltz to claim...");

    let handled = false;

    ws.on("update", async (update) => {
        if (update.id !== swap.id || handled) return;

        try {
            switch (update.status) {
                case swapStatusPending.TransactionClaimPending: {
                    handled = true;
                    console.log(`Status: ${update.status}`);

                    const claimDetails = await getSubmarineClaimDetails(
                        swap.id,
                    );
                    console.log("Server claim details received");

                    const { publicNonce, partialSignature } =
                        createSubmarineClaimSignature(
                            swap,
                            refundKeys,
                            claimDetails,
                        );

                    await postSubmarineClaimDetails(
                        swap.id,
                        publicNonce,
                        partialSignature,
                    );
                    console.log("🎉 Cooperative claim signature sent to Boltz");
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
