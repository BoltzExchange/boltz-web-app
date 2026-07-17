/* eslint-disable no-console */
//
// Static reusable USDC deposit address -> swap out to Liquid L-BTC.
//
// Flow:
//   1. Derive a reusable EVM address from a mnemonic.
//   2. Send USDC to it on Polygon / Ethereum / Base.
//   3. The watcher bridges each deposit to Arbitrum via CCTP (gas-sponsored),
//      locks it into a Boltz commitment, quotes the swap-out, waits for your
//      `approveQuote`, then settles to the L-BTC address from `resolveOut`.
//
// ── Run ────────────────────────────────────────────────────────────────────
//   DEPOSIT_MNEMONIC="twelve word ..." \
//   LBTC_ADDRESS=lq1... \
//     bun run examples/depositWatcher.ts
//
// ── Environment ──────────────────────────────────────────────────────────────
//   DEPOSIT_MNEMONIC         (required) BIP-39 mnemonic. The SDK derives the
//                            reusable address and signs the sponsored bridge +
//                            commitment lockup. KEEP IT SECRET.
//   LBTC_ADDRESS             Liquid L-BTC address that receives each swap-out.
//                            Required unless LN_DESTINATION is set.
//   LN_DESTINATION           (optional) a reusable Lightning destination — an
//                            LNURL, Lightning address, BOLT12 offer, or BIP-353
//                            name. If set, deposits settle to Lightning and the
//                            SDK fetches a right-sized invoice per deposit.
//   DEPOSIT_INDEX            (optional) HD address index (default 0).
//   ALCHEMY_GAS_SPONSOR_URL  (optional) overrides the default Boltz gas sponsor.
//
// ⚠️  This example uses in-memory storage, so it does NOT resume across
//     restarts. Back `DepositStorage` with durable storage in production.
//
import { createBoltzClient } from "boltz-swaps";
import {
    type DepositQuote,
    type DepositResolveContext,
    createDepositStorage,
} from "boltz-swaps/deposit";
import { type MainnetAsset, mainnetConfig } from "boltz-swaps/presets/mainnet";
import { MemoryKeyValueStore } from "boltz-swaps/storage";

declare const process: {
    env: Record<string, string | undefined>;
    exit: (code: number) => never;
};

const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (value === undefined || value === "") {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
    return value;
};

const main = async () => {
    const mnemonic = requireEnv("DEPOSIT_MNEMONIC");
    const lnDestination = process.env.LN_DESTINATION;
    const lbtcAddress =
        lnDestination === undefined || lnDestination === ""
            ? requireEnv("LBTC_ADDRESS")
            : undefined;
    const index = Number(process.env.DEPOSIT_INDEX ?? "0");

    const boltz = createBoltzClient<MainnetAsset>({
        ...mainnetConfig,
        network: "mainnet",
        referral: "sdk-example",
        gasSponsor: process.env.ALCHEMY_GAS_SPONSOR_URL,
    });

    const { address } = boltz.deposit.derive({ mnemonic, index });
    console.log(`Reusable deposit address (index ${index}): ${address}`);
    console.log("Send USDC on Polygon / Ethereum / Base to this address.\n");

    // In-memory storage does not survive restarts. In the browser, persist with
    // localStorage so the watcher can resume in-flight deposits:
    //   import { LocalStorageKeyValueStore } from "boltz-swaps/storage";
    //   const storage = createDepositStorage(
    //       new LocalStorageKeyValueStore({ prefix: "boltz.deposit." }));
    const storage = createDepositStorage(
        new MemoryKeyValueStore({
            inMemoryStorageShouldNeverBeUsedInProduction: true,
        }),
    );
    const watcher = await boltz.deposit.createWatcher({
        mnemonic,
        index,
        storage,
        // Each detected deposit settles to Lightning (if LN_DESTINATION is set)
        // or to the L-BTC address. `ctx` carries the post-bridge amount; for
        // Lightning the SDK fetches a right-sized invoice from the destination.
        resolveOut: (ctx: DepositResolveContext) => {
            if (lnDestination !== undefined) {
                console.log(
                    `  bridged ~${ctx.mintedSats} sats -> Lightning ${lnDestination}`,
                );
                return { type: "lightning", destination: lnDestination };
            }
            console.log(
                `  bridged ~${ctx.mintedSats} sats -> L-BTC ${lbtcAddress}`,
            );
            return {
                type: "chain",
                to: "L-BTC",
                address: lbtcAddress as string,
            };
        },
        approveQuote: (quote: DepositQuote) => {
            console.log(
                `  quote: lock ${quote.lockAmountSats} sats -> receive ${quote.receiveAmountSats} ${quote.receiveAsset} (bridge fee ${quote.bridgeFee})`,
            );
            return true;
        },
        onEvent: (record) => console.log(`  [${record.id}] ${record.phase}`),
        onError: (error) => console.error("  watcher error:", error),
    });

    console.log(`Watching ${watcher.address} (Ctrl+C to stop)…`);
};

void main().catch((err) => {
    console.error(
        "\n❌ Deposit watcher failed:",
        err instanceof Error ? err.message : err,
    );
    process.exit(1);
});
