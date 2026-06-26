/* eslint-disable no-console */
//
// Full L-BTC -> Lightning submarine swap, driven entirely by the SDK.
//
// Flow:
//   1. Create the submarine swap for the Lightning invoice you want paid.
//   2. Fund the returned L-BTC lockup address from any external wallet.
//   3. Boltz pays the invoice, then claims the lockup. Co-signing
//      (`swap.submarine.signClaim`) lets Boltz claim cooperatively (cheaper /
//      faster) once it reaches `transaction.claim.pending`; it is otherwise
//      claimed via the script path.
//   4. If Boltz cannot pay the invoice, refund the L-BTC with
//      `swap.submarine.refundUtxo(...)` after the timeout.
//
// ── Run ────────────────────────────────────────────────────────────────────
//   LN_INVOICE=lnbc... \
//     bun run examples/submarineSwapFromLbtc.ts
//
// ── Environment ──────────────────────────────────────────────────────────────
//   LN_INVOICE               (required) the BOLT11/BOLT12 invoice to pay.
//   BOLTZ_REFUND_PRIVATE_KEY (optional) 64-hex L-BTC refund key; random if unset.
//
// ⚠️  This spends real mainnet L-BTC. The refund key and lockup blinding key
//     printed below are the only way to refund it if Boltz cannot pay — save
//     them before funding.
//
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import { type MainnetAsset, mainnetConfig } from "boltz-swaps/presets/mainnet";
import {
    SwapStatus,
    isFailureStatus,
    isFinalStatus,
    isSuccessStatus,
} from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";

declare const process: {
    env: Record<string, string | undefined>;
    exit: (code: number) => never;
};

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

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
    const invoice = requireEnv("LN_INVOICE");

    const refundKeys =
        process.env.BOLTZ_REFUND_PRIVATE_KEY !== undefined
            ? fromPrivateKey(hex.decode(process.env.BOLTZ_REFUND_PRIVATE_KEY))
            : randomKeypair();

    const boltz = createBoltzClient<MainnetAsset>({
        ...mainnetConfig,
        network: "mainnet",
        referral: "sdk-example",
    });

    console.log("Recovery material — SAVE THESE before funding:");
    console.log(`  refund private key: ${hex.encode(refundKeys.privateKey)}\n`);

    console.log("Fetching pairs from Boltz mainnet…");
    const pairs = await getPairs();
    const pair = pairs[SwapType.Submarine]?.["L-BTC"]?.["BTC"];
    if (pair === undefined) {
        throw new Error("Boltz does not currently offer an L-BTC -> LN swap");
    }

    console.log("\nCreating L-BTC -> LN submarine swap…");
    const createdSwap = await boltz.swap.submarine.create({
        from: "L-BTC",
        to: "BTC",
        invoice,
        pairHash: pair.hash,
        refundPublicKey: hex.encode(refundKeys.publicKey),
    });

    console.log(`\nSwap created: ${createdSwap.id}`);
    console.log("Fund the L-BTC lockup from any external wallet:");
    console.log(`  address: ${createdSwap.address}`);
    console.log(`  amount:  ${createdSwap.expectedAmount} sats`);
    if (createdSwap.bip21 !== undefined) {
        console.log(`  bip21:   ${createdSwap.bip21}`);
    }
    if (createdSwap.blindingKey !== undefined) {
        console.log(`  lockup blinding key: ${createdSwap.blindingKey}`);
    }

    console.log("\nPolling swap status every 5s (Ctrl+C to stop)…");
    let lastStatus = "";
    let coSigned = false;
    for (;;) {
        const { status } = await boltz.swap.status(createdSwap.id);
        if (status !== lastStatus) {
            console.log(`  status: ${status}`);
            lastStatus = status;
        }

        // Once Boltz is ready to claim, co-sign so it can claim cooperatively.
        if (status === SwapStatus.TransactionClaimPending && !coSigned) {
            console.log("  co-signing the cooperative claim…");
            await boltz.swap.submarine.signClaim({
                id: createdSwap.id,
                asset: "L-BTC",
                swapTree: createdSwap.swapTree,
                claimPublicKey: createdSwap.claimPublicKey,
                refundKeys,
                invoice,
            });
            coSigned = true;
        }

        if (isSuccessStatus(status)) {
            console.log("\n✅ Invoice paid and lockup claimed by Boltz");
            return;
        }
        if (isFinalStatus(status)) {
            throw new Error(
                isFailureStatus(status)
                    ? `swap failed with status ${status} — refund the L-BTC ` +
                          `with swap.submarine.refundUtxo after the timeout`
                    : `unexpected terminal status ${status}`,
            );
        }
        await sleep(5_000);
    }
};

void main().catch((err) => {
    console.error(
        "\n❌ Submarine swap failed:",
        err instanceof Error ? err.message : err,
    );
    process.exit(1);
});
