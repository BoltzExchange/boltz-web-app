/* eslint-disable no-console */
//
// Full L-BTC -> USDC on Base, driven entirely by the SDK.
//
// This composes a Boltz chain swap with a post-claim DEX swap and a CCTP
// bridge, all settled in ONE on-chain "router claim":
//   L-BTC --chain swap--> <BTC-pegged EVM token> --DEX--> USDC --CCTP--> Base
//
// Flow:
//   1. `route.create` plans the legs and creates the underlying chain swap to
//      the via/landing asset (the chain-swap destination), committing the
//      signer's EOA as the claim address.
//   2. You fund the returned L-BTC lockup address from any external wallet.
//   3. Poll `swap.status(id)` yourself; once Boltz has locked the destination,
//      `route.execute(...)` claims it and, in the same tx, runs the DEX swap and
//      bridges USDC to your Base address.
//
// ── Run ────────────────────────────────────────────────────────────────────
//   EVM_PRIVATE_KEY=0x<key> \
//   RECIPIENT_ADDRESS=0x<your-base-address> \
//   BOLTZ_AMOUNT_SATS=250000 \
//     bun run examples/routeLbtcToUsdcBase.ts
//
// ── Environment ──────────────────────────────────────────────────────────────
//   EVM_PRIVATE_KEY          (required) 0x-prefixed local key that signs and
//                            sponsors the claim (gas-abstracted via the Alchemy
//                            gas sponsor, EIP-7702). It needs no native gas.
//   RECIPIENT_ADDRESS        (required for bridge routes) Base address that
//                            receives the USDC. A bridge delivers funds on a
//                            different chain, so it is never defaulted to the
//                            signer.
//   BOLTZ_AMOUNT_SATS        (optional) L-BTC to lock, in sats. Default 250000.
//   EVM_RPC_URL              (optional) RPC for the via-asset chain (the chain
//                            the DEX runs on). Defaults to the preset RPC.
//   ALCHEMY_GAS_SPONSOR_URL  (optional) overrides the default Boltz gas sponsor.
//   SLIPPAGE                 (optional) fraction (e.g. 0.01 == 1%). Default 0.01.
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
import { calculateAmountOutMin } from "boltz-swaps/helper";
import type { Signer } from "boltz-swaps/interfaces";
import { type MainnetAsset, mainnetConfig } from "boltz-swaps/presets/mainnet";
import {
    isChainSwapClaimable,
    isFailureStatus,
    isFinalStatus,
} from "boltz-swaps/status";
import {
    type Hex,
    type PublicClient,
    createPublicClient,
    createWalletClient,
    getAddress,
    http,
} from "viem";
import { type PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

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

// Transport-only signer: the via-asset chain is resolved at runtime, so the
// chain id is read from the node rather than hard-coded.
const buildSigner = (account: PrivateKeyAccount, rpcUrl: string): Signer => {
    const provider = createPublicClient({
        transport: http(rpcUrl),
    }) as PublicClient;
    const wallet = createWalletClient({ account, transport: http(rpcUrl) });
    return Object.assign(wallet, {
        address: account.address,
        provider,
        rdns: "sdk-example",
    }) as Signer;
};

const main = async () => {
    const account = privateKeyToAccount(requireEnv("EVM_PRIVATE_KEY") as Hex);
    const amountSats = Number(process.env.BOLTZ_AMOUNT_SATS ?? "250000");
    const slippage = Number(process.env.SLIPPAGE ?? "0.01");
    // Resolved against the plan below: a bridge route requires it explicitly,
    // while a same-chain route may default it to the signer.
    const recipientEnv = process.env.RECIPIENT_ADDRESS;

    // Secrets needed to claim (preimage) and to refund the L-BTC if it fails.
    const preimage =
        process.env.BOLTZ_PREIMAGE !== undefined
            ? hex.decode(process.env.BOLTZ_PREIMAGE)
            : crypto.getRandomValues(new Uint8Array(32));
    const refundKeypair =
        process.env.BOLTZ_REFUND_PRIVATE_KEY !== undefined
            ? fromPrivateKey(hex.decode(process.env.BOLTZ_REFUND_PRIVATE_KEY))
            : randomKeypair();

    const boltz = createBoltzClient<MainnetAsset>({
        ...mainnetConfig,
        network: "mainnet",
        referral: "sdk-example",
        defaultSlippage: slippage,
        gasSponsor: process.env.ALCHEMY_GAS_SPONSOR_URL,
    });

    console.log("Recovery material — SAVE THESE before funding:");
    console.log(`  preimage:           ${hex.encode(preimage)}`);
    console.log(
        `  refund private key: ${hex.encode(refundKeypair.privateKey)}\n`,
    );

    // 1) Plan the route and create the underlying chain swap. The committed
    //    claim address is the signer's EOA — the router claims on its behalf.
    console.log("Fetching pairs from Boltz mainnet…");
    const pairs = await getPairs();

    console.log(`\nCreating L-BTC -> USDC-BASE route for ${amountSats} sats…`);
    const { createdSwap, plan } = await boltz.route.create({
        from: "L-BTC",
        to: "USDC-BASE",
        pairs,
        userLockAmount: amountSats,
        preimageHash: hex.encode(sha256(preimage)),
        claimAddress: account.address,
        refundPublicKey: hex.encode(refundKeypair.publicKey),
    });

    const viaAsset = plan.chainSwap.to;
    console.log(
        `\nRoute: L-BTC -> ${viaAsset}` +
            (plan.dex !== undefined ? " -> (DEX) USDC" : "") +
            (plan.bridge !== undefined ? " -> (CCTP) USDC-BASE" : ""),
    );

    // A bridge route delivers funds on a DIFFERENT chain, so the destination
    // must be explicit — never default a cross-chain recipient to the signer.
    if (plan.bridge !== undefined && recipientEnv === undefined) {
        console.error(
            `\nRECIPIENT_ADDRESS is required for a bridge route (-> ${plan.to}). ` +
                "Refusing to default the cross-chain destination to the signer.",
        );
        process.exit(1);
    }
    const recipient =
        recipientEnv !== undefined ? getAddress(recipientEnv) : account.address;
    console.log(`Final destination (${plan.to}): ${recipient}`);

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

    // The signer / gas sponsor operate on the via-asset's chain (where the DEX
    // runs); CCTP then bridges the USDC to Base.
    const rpcUrl =
        process.env.EVM_RPC_URL ??
        mainnetConfig.assets[viaAsset]?.network?.rpcUrls?.[0];
    if (rpcUrl === undefined) {
        throw new Error(`no RPC URL configured for via-asset ${viaAsset}`);
    }
    const signer = buildSigner(account, rpcUrl);

    // 2) Poll the status yourself until Boltz has locked the destination, then
    //    claim. `execute` does the claim only — it does not poll.
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

    // 3) Pin the minimum we will accept. In a real app, derive this from the
    //    quote the user actually accepted; here we re-quote just before claiming
    //    so market drift can't push the received amount below our slippage band.
    //    `route.execute` enforces this exact floor instead of recomputing one
    //    from its own fresh quote (and throws up front if the quote already
    //    drifted below it).
    const quote = await boltz.route.quoteAmountOut({
        from: "L-BTC",
        to: "USDC-BASE",
        pairs,
        amountIn: BigInt(amountSats),
        recipient,
    });
    const minReceiveAmount = calculateAmountOutMin(
        quote.receiveAmount,
        slippage,
    );
    console.log(
        `Quoted ~${quote.receiveAmount} USDC base units; ` +
            `will not accept less than ${minReceiveAmount}.`,
    );

    // 4) Claim the destination + DEX + bridge in one atomic router claim.
    console.log("\nClaiming + swapping + bridging to Base…");
    const result = await boltz.route.execute({
        createdSwap,
        plan,
        preimage: hex.encode(preimage),
        signer,
        recipient,
        minReceiveAmount,
    });

    console.log("\n✅ Router claim broadcast");
    console.log(`  tx: ${result.claimTransactionId}`);
    console.log(
        "  USDC will arrive on Base once CCTP attests the burn — track it on " +
            "the CCTP explorer.",
    );
};

void main().catch((err) => {
    console.error(
        "\n❌ Route failed:",
        err instanceof Error ? err.message : err,
    );
    console.error(
        "If you already funded the L-BTC lockup, use the printed preimage, " +
            "refund key and lockup blinding key to recover it after the timeout.",
    );
    process.exit(1);
});
