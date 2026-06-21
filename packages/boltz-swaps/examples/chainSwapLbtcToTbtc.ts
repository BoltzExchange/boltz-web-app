/* eslint-disable no-console */
//
// Full L-BTC -> TBTC chain swap, driven entirely by the SDK.
//
// Flow:
//   1. Create the chain swap (source = L-BTC, destination = TBTC on Arbitrum).
//   2. You fund the returned L-BTC lockup address from any external wallet.
//   3. Poll `swap.status(id)` yourself; once Boltz has locked TBTC,
//      `swap.chain.execute(...)` claims it to your Arbitrum address.
//
// ── Run ────────────────────────────────────────────────────────────────────
//   EVM_PRIVATE_KEY=0x<arbitrum-key> \
//   BOLTZ_AMOUNT_SATS=250000 \
//     bun run examples/chainSwapLbtcToTbtc.ts
//
// ── Environment ──────────────────────────────────────────────────────────────
//   EVM_PRIVATE_KEY          (required) 0x-prefixed local key that signs and
//                            sponsors the claim (gas-abstracted via the Alchemy
//                            gas sponsor, EIP-7702). It needs no ETH and does
//                            not have to receive the TBTC.
//   CLAIM_ADDRESS            (optional) Arbitrum address that receives the TBTC.
//                            Defaults to the signer's own address.
//   BOLTZ_AMOUNT_SATS        (optional) L-BTC to lock, in sats. Default 250000.
//   ARBITRUM_RPC_URL         (optional) overrides the preset Arbitrum RPC.
//   ALCHEMY_GAS_SPONSOR_URL  (optional) overrides the default Boltz gas sponsor.
//   BOLTZ_PREIMAGE           (optional) 64-hex preimage; random if unset.
//   BOLTZ_REFUND_PRIVATE_KEY (optional) 64-hex L-BTC refund key; random if unset.
//
// ⚠️  This spends real mainnet L-BTC. The preimage, refund key and the lockup
//     blinding key printed below are the ONLY way to refund the L-BTC if the
//     swap does not complete — copy them somewhere safe before funding.
//
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import type { Signer } from "boltz-swaps/interfaces";
import { type MainnetAsset, mainnetConfig } from "boltz-swaps/presets/mainnet";
import {
    isChainSwapClaimable,
    isFailureStatus,
    isFinalStatus,
} from "boltz-swaps/status";
import { SwapType } from "boltz-swaps/types";
import {
    type Hex,
    type PublicClient,
    createPublicClient,
    createWalletClient,
    getAddress,
    http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";

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

const buildSigner = (privateKey: Hex, rpcUrl: string): Signer => {
    const account = privateKeyToAccount(privateKey);
    const provider = createPublicClient({
        chain: arbitrum,
        transport: http(rpcUrl),
    }) as PublicClient;
    // The connected signer carries no fixed chain (chain is supplied per call),
    // matching the SDK's `Signer` shape.
    const wallet = createWalletClient({ account, transport: http(rpcUrl) });
    return Object.assign(wallet, {
        address: account.address,
        provider,
        rdns: "sdk-example",
    }) as Signer;
};

const main = async () => {
    const evmPrivateKey = requireEnv("EVM_PRIVATE_KEY") as Hex;
    const amountSats = Number(process.env.BOLTZ_AMOUNT_SATS ?? "250000");
    const rpcUrl =
        process.env.ARBITRUM_RPC_URL ??
        mainnetConfig.assets.TBTC.network?.rpcUrls?.[0];
    if (rpcUrl === undefined) {
        throw new Error("no Arbitrum RPC URL available");
    }

    // Secrets needed to claim (preimage) and to refund the L-BTC if it fails.
    const preimage =
        process.env.BOLTZ_PREIMAGE !== undefined
            ? hex.decode(process.env.BOLTZ_PREIMAGE)
            : crypto.getRandomValues(new Uint8Array(32));
    const refundKeypair =
        process.env.BOLTZ_REFUND_PRIVATE_KEY !== undefined
            ? fromPrivateKey(hex.decode(process.env.BOLTZ_REFUND_PRIVATE_KEY))
            : randomKeypair();
    const claimKeypair = randomKeypair();

    const signer = buildSigner(evmPrivateKey, rpcUrl);

    // The signer only signs/sponsors the claim; the TBTC is sent here.
    const claimAddress =
        process.env.CLAIM_ADDRESS !== undefined
            ? getAddress(process.env.CLAIM_ADDRESS)
            : signer.address;

    const boltz = createBoltzClient<MainnetAsset>({
        ...mainnetConfig,
        network: "mainnet",
        referral: "sdk-example",
        // Claims are gas-abstracted through this Alchemy sponsor; defaults to
        // the Boltz gas sponsor when unset.
        gasSponsor: process.env.ALCHEMY_GAS_SPONSOR_URL,
    });

    console.log("Recovery material — SAVE THESE before funding:");
    console.log(`  preimage:           ${hex.encode(preimage)}`);
    console.log(
        `  refund private key: ${hex.encode(refundKeypair.privateKey)}`,
    );
    console.log(`  claim (TBTC) address: ${claimAddress}\n`);

    // 1) Resolve the chain-swap pair hash (commits to the fees we accept).
    console.log("Fetching pairs from Boltz mainnet…");
    const pairs = await getPairs();
    const pair = pairs[SwapType.Chain]?.["L-BTC"]?.["TBTC"];
    if (pair === undefined) {
        throw new Error(
            "Boltz does not currently offer an L-BTC -> TBTC chain swap",
        );
    }
    console.log(
        `L-BTC -> TBTC limits: min ${pair.limits.minimal} / max ${pair.limits.maximal} sats`,
    );
    if (amountSats < pair.limits.minimal || amountSats > pair.limits.maximal) {
        throw new Error(
            `BOLTZ_AMOUNT_SATS=${amountSats} is outside the pair limits`,
        );
    }

    // 2) Create the swap. L-BTC is the lockup side; TBTC is the claim side.
    console.log(`\nCreating L-BTC -> TBTC chain swap for ${amountSats} sats…`);
    const createdSwap = await boltz.swap.chain.create({
        from: "L-BTC",
        to: "TBTC",
        userLockAmount: amountSats,
        preimageHash: hex.encode(sha256(preimage)),
        claimPublicKey: hex.encode(claimKeypair.publicKey),
        refundPublicKey: hex.encode(refundKeypair.publicKey),
        claimAddress,
        pairHash: pair.hash,
    });

    const lockup = createdSwap.lockupDetails;
    console.log(`\nSwap created: ${createdSwap.id}`);
    console.log("Fund the L-BTC lockup from any external wallet:");
    console.log(`  address: ${lockup.lockupAddress}`);
    console.log(`  amount:  ${lockup.amount} sats`);
    if (lockup.bip21 !== undefined) {
        console.log(`  bip21:   ${lockup.bip21}`);
    }
    if (lockup.blindingKey !== undefined) {
        // Needed (together with the refund key + preimage) to refund the L-BTC.
        console.log(`  lockup blinding key: ${lockup.blindingKey}`);
    }
    console.log(
        `\nExpected to receive ~${createdSwap.claimDetails.amount} TBTC base units (18 dec).`,
    );

    // 3) Poll the status yourself until Boltz has locked TBTC, then claim it.
    //    `execute` does the claim only — it does not poll.
    console.log("\nPolling swap status every 5s (Ctrl+C to stop)…");
    let lastStatus = "";
    for (;;) {
        const { status } = await boltz.swap.status(createdSwap.id);
        if (status !== lastStatus) {
            console.log(`  status: ${status}`);
            lastStatus = status;
        }
        if (isChainSwapClaimable({ status })) {
            break;
        }
        if (isFinalStatus(status)) {
            throw new Error(
                isFailureStatus(status)
                    ? `swap failed with status ${status}`
                    : `swap already settled (${status})`,
            );
        }
        await sleep(5_000);
    }

    console.log("\nClaiming TBTC…");
    const result = await boltz.swap.chain.execute({
        createdSwap,
        to: "TBTC",
        preimage: hex.encode(preimage),
        claimAddress,
        signer,
    });

    console.log("\n✅ Claimed");
    console.log(`  claim tx: ${result.claimTransactionId}`);
    console.log(
        `  received: ${result.receiveAmount ?? "?"} TBTC base units (18 dec)`,
    );
};

void main().catch((err) => {
    console.error(
        "\n❌ Swap failed:",
        err instanceof Error ? err.message : err,
    );
    console.error(
        "If you already funded the L-BTC lockup, use the printed preimage, " +
            "refund key and lockup blinding key to recover it after the timeout.",
    );
    process.exit(1);
});
