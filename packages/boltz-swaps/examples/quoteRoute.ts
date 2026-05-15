/* eslint-disable no-console */
import {
    RouteLegKind,
    type RouteQuote,
    RouteUnavailableError,
    createBoltzClient,
    getPairs,
} from "boltz-swaps";
import { type MainnetAsset, mainnetConfig } from "boltz-swaps/presets/mainnet";

const boltz = createBoltzClient<MainnetAsset>({
    assets: mainnetConfig.assets,
    referral: "sdk-example",
});

const formatLeg = (leg: RouteQuote<MainnetAsset>["legs"][number]): string => {
    switch (leg.kind) {
        case RouteLegKind.ChainSwap:
            return `  chain-swap  ${leg.from} -> ${leg.to}: ${leg.sendAmount} -> ${leg.receiveAmount} (${leg.fees.percentage}% + server=${leg.fees.minerFees.server}, claim=${leg.fees.minerFees.userClaim})`;
        case RouteLegKind.Dex:
            return `  dex         on ${leg.chain}: ${leg.amountIn} -> ${leg.amountOut}`;
        case RouteLegKind.Bridge: {
            const fee = leg.messagingFee
                ? ` msgFee=${leg.messagingFee.amount}${leg.messagingFee.token ? ` ${leg.messagingFee.token}` : ""}`
                : "";
            return `  bridge      ${leg.route.sourceAsset} -> ${leg.route.destinationAsset}: ${leg.amountIn} -> ${leg.amountOut}${fee}`;
        }
    }
};

const showQuote = (label: string, quote: RouteQuote<MainnetAsset>) => {
    console.log(`\n${label}`);
    console.log(
        `  total: ${quote.sendAmount} ${quote.from} -> ${quote.receiveAmount} ${quote.to}`,
    );
    for (const leg of quote.legs) {
        console.log(formatLeg(leg));
    }
};

const tryQuote = async (
    label: string,
    run: () => Promise<RouteQuote<MainnetAsset>>,
) => {
    try {
        showQuote(label, await run());
    } catch (e) {
        if (e instanceof RouteUnavailableError) {
            console.log(`\n${label}\n  unavailable: ${e.reason}`);
        } else {
            console.log(`\n${label}\n  failed: ${(e as Error).message}`);
        }
    }
};

const main = async () => {
    console.log("Fetching pairs from Boltz mainnet API…");
    const pairs = await getPairs();

    // 1) BTC -> USDC-ETH: canonical landing. No bridge leg
    await tryQuote("BTC -> USDC-ETH (forward, 100_000 sats)", () =>
        boltz.route.quoteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            amountIn: 100_000n,
            pairs,
        }),
    );

    // 2) BTC -> USDC-BASE: CCTP bridge from canonical USDC-ETH to USDC-BASE
    await tryQuote("BTC -> USDC-BASE (forward, 200_000 sats)", () =>
        boltz.route.quoteAmountOut({
            from: "BTC",
            to: "USDC-BASE",
            amountIn: 200_000n,
            pairs,
            recipient: "0x000000000000000000000000000000000000dEaD",
        }),
    );

    // 3) Reverse: I want exactly 50 USDC on Base (50_000_000 in 6-decimal
    //    base units). How many sats must I lock?
    await tryQuote("BTC -> USDC-BASE (reverse, want 50 USDC out)", () =>
        boltz.route.quoteAmountIn({
            from: "BTC",
            to: "USDC-BASE",
            amountOut: 50_000_000n,
            pairs,
            recipient: "0x000000000000000000000000000000000000dEaD",
        }),
    );

    // 4) Full 3-leg: BTC chain-swap to TBTC-ETH, DEX hop TBTC-ETH -> USDT0-ETH
    //    (canonical), then OFT bridge USDT0-ETH -> USDT0-POL.
    await tryQuote("BTC -> USDT0-POL (forward, 500_000 sats)", () =>
        boltz.route.quoteAmountOut({
            from: "BTC",
            to: "USDT0-POL",
            amountIn: 500_000n,
            pairs,
            recipient: "0x000000000000000000000000000000000000dEaD",
        }),
    );
};

void main();
