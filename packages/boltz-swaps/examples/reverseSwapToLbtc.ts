/* eslint-disable no-console */
//
// Full Lightning -> L-BTC reverse swap, driven entirely by the SDK.
//
// Flow:
//   1. Create the reverse swap. Boltz returns a hold invoice.
//   2. You pay that invoice from any Lightning wallet.
//   3. Boltz locks L-BTC on-chain; watch `swap.watch(id)` for status updates.
//   4. Once the lockup confirms, `swap.reverse.execute(...)` claims the L-BTC
//      to your address (cooperatively; it falls back to the script path if
//      Boltz refuses to co-sign). Claiming reveals the preimage, which settles
//      the invoice.
//
// ── Run ────────────────────────────────────────────────────────────────────
//   CLAIM_ADDRESS=<l-btc-address> \
//   BOLTZ_AMOUNT_SATS=100000 \
//     bun run examples/reverseSwapToLbtc.ts
//
// ── Environment ──────────────────────────────────────────────────────────────
//   CLAIM_ADDRESS         (required) L-BTC address that receives the coins.
//   BOLTZ_AMOUNT_SATS     (optional) invoice amount, in sats. Default 100000.
//   BOLTZ_PREIMAGE        (optional) 64-hex preimage; random if unset.
//   BOLTZ_CLAIM_PRIVATE_KEY (optional) 64-hex claim key; random if unset.
//
// ⚠️  This pays a real mainnet Lightning invoice. The preimage and claim key
//     printed below are the only way to claim the L-BTC — save them before
//     paying the invoice.
//
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import { type MainnetAsset, mainnetConfig } from "boltz-swaps/presets/mainnet";
import { SwapStatus, isFailureStatus, isFinalStatus } from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";

declare const process: {
    env: Record<string, string | undefined>;
    exit: (code: number) => never;
};

type Keypair = { privateKey: Uint8Array; publicKey: Uint8Array };

const fromPrivateKey = (privateKey: Uint8Array): Keypair => ({
    privateKey,
    publicKey: secp256k1.getPublicKey(privateKey, true),
});

const randomKeypair = (): Keypair =>
    fromPrivateKey(secp256k1.utils.randomSecretKey());

const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (value === undefined || value === "") {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
    return value;
};

const main = async () => {
    const claimAddress = requireEnv("CLAIM_ADDRESS");
    const amountSats = Number(process.env.BOLTZ_AMOUNT_SATS ?? "100000");

    const preimage =
        process.env.BOLTZ_PREIMAGE !== undefined
            ? hex.decode(process.env.BOLTZ_PREIMAGE)
            : crypto.getRandomValues(new Uint8Array(32));
    const claimKeys =
        process.env.BOLTZ_CLAIM_PRIVATE_KEY !== undefined
            ? fromPrivateKey(hex.decode(process.env.BOLTZ_CLAIM_PRIVATE_KEY))
            : randomKeypair();

    const boltz = createBoltzClient<MainnetAsset>({
        ...mainnetConfig,
        network: "mainnet",
        referral: "sdk-example",
    });

    console.log("Recovery material — SAVE THESE before paying the invoice:");
    console.log(`  preimage:          ${hex.encode(preimage)}`);
    console.log(`  claim private key: ${hex.encode(claimKeys.privateKey)}`);
    console.log(`  claim address:     ${claimAddress}\n`);

    console.log("Fetching pairs from Boltz mainnet…");
    const pairs = await getPairs();
    const pair = pairs[SwapType.Reverse]?.["BTC"]?.["L-BTC"];
    if (pair === undefined) {
        throw new Error("Boltz does not currently offer an LN -> L-BTC swap");
    }
    if (amountSats < pair.limits.minimal || amountSats > pair.limits.maximal) {
        throw new Error(
            `BOLTZ_AMOUNT_SATS=${amountSats} is outside the pair limits ` +
                `(min ${pair.limits.minimal} / max ${pair.limits.maximal})`,
        );
    }

    console.log(`\nCreating LN -> L-BTC reverse swap for ${amountSats} sats…`);
    const createdSwap = await boltz.swap.reverse.create({
        from: "BTC",
        to: "L-BTC",
        invoiceAmount: amountSats,
        preimageHash: hex.encode(sha256(preimage)),
        pairHash: pair.hash,
        claimPublicKey: hex.encode(claimKeys.publicKey),
        claimAddress,
    });

    console.log(`\nSwap created: ${createdSwap.id}`);
    console.log("Pay this Lightning invoice from any wallet:");
    console.log(`  ${createdSwap.invoice}`);
    console.log(
        `\nBoltz will lock ${createdSwap.onchainAmount} sats of L-BTC once paid.`,
    );

    console.log("\nWatching swap status (Ctrl+C to stop)…");
    let lastStatus = "";
    for await (const { status } of boltz.swap.watch(createdSwap.id)) {
        if (status !== lastStatus) {
            console.log(`  status: ${status}`);
            lastStatus = status;
        }
        if (status === SwapStatus.TransactionConfirmed) {
            break;
        }
        if (isFinalStatus(status)) {
            throw new Error(
                isFailureStatus(status)
                    ? `swap failed with status ${status}`
                    : `swap already settled (${status})`,
            );
        }
    }

    const receiveAmount = createdSwap.onchainAmount - pair.fees.minerFees.claim;

    console.log("\nClaiming L-BTC…");
    const result = await boltz.swap.reverse.execute({
        createdSwap,
        to: "L-BTC",
        preimage: hex.encode(preimage),
        receiveAmount,
        claimAddress,
        claimKeys,
    });

    console.log("\n✅ Claimed");
    console.log(`  claim tx: ${result.claimTransactionId}`);
    console.log(`  received: ${result.receiveAmount ?? receiveAmount} sats`);
};

void main().catch((err) => {
    console.error(
        "\n❌ Reverse swap failed:",
        err instanceof Error ? err.message : err,
    );
    process.exit(1);
});
