import { bridgeRegistry } from "../bridge/index.ts";
import type {
    ChainPairTypeTaproot,
    ChainSwapCreatedResponse,
} from "../client.ts";
import { assetAmountToSats } from "../evm/rootstock.ts";
import {
    DEPOSIT_BRIDGE_ASSET,
    type DepositChainOut,
    type DepositQuote,
    type DepositQuoteTarget,
} from "./types.ts";

// Bridge-leg estimate (source USDC -> Arbitrum USDC) for the standalone
// `deposit.quote` preview and for the engine's `suggestedReceiveSats`.
export const estimateBridgeNet = async (
    sourceAsset: string,
    amount: bigint,
): Promise<{ amountOut: bigint; bridgeFee: bigint }> => {
    const driver = bridgeRegistry.requireDriverForAsset(sourceAsset);
    const route = driver.getPreRoute(sourceAsset);
    if (route === undefined) {
        throw new Error(`no CCTP pre-route for ${sourceAsset}`);
    }
    const { amountOut } = await driver.quoteReceiveAmount(route, amount);
    return {
        amountOut,
        bridgeFee: amount > amountOut ? amount - amountOut : 0n,
    };
};

// Net sats delivered to the claim address after the user's claim miner fee
// (which is funded out of the gross claim amount).
export const chainReceiveSats = (
    created: ChainSwapCreatedResponse,
    pair: ChainPairTypeTaproot,
): number =>
    Math.max(0, created.claimDetails.amount - pair.fees.minerFees.user.claim);

export const buildChainQuote = (args: {
    depositId: string;
    swapId: string;
    created: ChainSwapCreatedResponse;
    to: DepositChainOut;
    pair: ChainPairTypeTaproot;
    bridgeFee: bigint;
}): DepositQuote => ({
    depositId: args.depositId,
    swapId: args.swapId,
    target: "chain",
    lockAmountSats: args.created.lockupDetails.amount,
    receiveAsset: args.to,
    receiveAmountSats: chainReceiveSats(args.created, args.pair),
    bridgeFee: args.bridgeFee.toString(),
});

export const buildSubmarineQuote = (args: {
    depositId: string;
    swapId: string;
    // Sats actually locked on Arbitrum (the full bridged amount), not the
    // swap's `expectedAmount` — the server claims the whole commitment.
    lockAmountSats: number;
    invoiceSats: number;
    bridgeFee: bigint;
}): DepositQuote => ({
    depositId: args.depositId,
    swapId: args.swapId,
    target: "lightning",
    lockAmountSats: args.lockAmountSats,
    receiveAsset: "BTC",
    receiveAmountSats: args.invoiceSats,
    bridgeFee: args.bridgeFee.toString(),
});

// Standalone pre-flight preview (no swap created). Authoritative only for the
// bridge leg; the Boltz out-leg fee is applied at swap-create time and surfaced
// through the `approveQuote` quote in the watcher.
export const previewDepositQuote = async (args: {
    sourceAsset: string;
    amount: bigint;
    target: DepositQuoteTarget;
}): Promise<DepositQuote> => {
    const { amountOut, bridgeFee } = await estimateBridgeNet(
        args.sourceAsset,
        args.amount,
    );
    const lockAmountSats = Number(
        assetAmountToSats(amountOut, DEPOSIT_BRIDGE_ASSET),
    );
    return {
        depositId: "",
        swapId: "",
        target: args.target.type === "lightning" ? "lightning" : "chain",
        lockAmountSats,
        receiveAsset: args.target.type === "lightning" ? "BTC" : args.target.to,
        // Gross ceiling: the out-leg (Boltz) fee is not applied in this preview.
        receiveAmountSats: lockAmountSats,
        bridgeFee: bridgeFee.toString(),
    };
};
