import { BigNumber } from "bignumber.js";
import {
    RouteUnavailableError,
    applyChainPairReceiveAmount,
    applyChainPairSendAmount,
    setBoltzSwapsConfig,
} from "boltz-swaps";
import {
    AssetKind,
    BridgeKind,
    CctpTransferMode,
    SwapType as HostSwapType,
    NetworkTransport,
    SwapType,
} from "boltz-swaps/types";

import {
    calculateReceiveAmount,
    calculateSendAmount,
} from "../../src/utils/calculate";
import {
    quoteRouteAmountIn,
    quoteRouteAmountOut,
} from "../../src/utils/routeQuoter";

const cctp = {
    domain: 0,
    tokenMessenger: "0xtm",
    messageTransmitter: "0xmt",
    transferMode: CctpTransferMode.Standard,
};

const baseEvmNetwork = (symbol: string) => ({
    chainName: symbol,
    symbol,
    gasToken: "ETH",
    transport: NetworkTransport.Evm,
    chainId: 1,
    rpcUrls: ["https://rpc"] as const,
});

beforeEach(() => {
    setBoltzSwapsConfig({
        boltzApiUrl: "https://test",
        assets: {
            BTC: { type: AssetKind.UTXO } as never,
            "USDC-ETH": {
                type: AssetKind.ERC20,
                network: baseEvmNetwork("ETH"),
                token: { address: "0xUSDC_ETH", decimals: 6 },
                bridge: {
                    kind: BridgeKind.Cctp,
                    canonicalAsset: "USDC-ETH",
                    cctp,
                },
            } as never,
        },
    });
});

const makeChainPair = (
    percentage: number,
    server: number,
    userClaim: number,
) => ({
    hash: "h",
    rate: 1,
    limits: { minimal: 1, maximal: 1_000_000_000, maximalZeroConf: 0 },
    fees: {
        percentage,
        minerFees: {
            server,
            user: { claim: userClaim, lockup: 0 },
        },
    },
});

const pairsWith = (pair: ReturnType<typeof makeChainPair>) =>
    ({
        [SwapType.Submarine]: {},
        [SwapType.Reverse]: {},
        [SwapType.Chain]: { BTC: { "USDC-ETH": pair } },
    }) as never;

describe("routeQuoter host adapter", () => {
    test("converts BigNumber sendAmount to bigint and wraps response", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // 100000 BTC sats → chain-swap sats=98400 → USDC-ETH base (6 dec)=984
        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith(pair),
            sendAmount: BigNumber(100_000),
        });
        expect(result.sendAmount.toFixed()).toBe("100000");
        expect(result.receiveAmount.toFixed()).toBe("984");
        expect(result.legs).toHaveLength(1);
        expect(result.raw.sendAmount).toBe(100_000n);
        expect(result.raw.receiveAmount).toBe(984n);
    });

    test("converts BigNumber receiveAmount to bigint for reverse", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // Want 984 USDC-ETH (6 decimals) → 98400 sats → 100000 BTC sats.
        const result = await quoteRouteAmountIn({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith(pair),
            receiveAmount: BigNumber(984),
        });
        expect(result.sendAmount.toFixed()).toBe("100000");
        expect(result.receiveAmount.toFixed()).toBe("984");
        expect(result.raw.sendAmount).toBe(100_000n);
        expect(result.raw.receiveAmount).toBe(984n);
    });

    test("floors BigNumber input before converting to bigint", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // BigNumber.toFixed(0) defaults to half-up rounding; we want floor for
        // deterministic behaviour given user-driven decimal input.
        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith(pair),
            sendAmount: BigNumber("100000.9"),
        });
        expect(result.raw.sendAmount).toBe(100_000n);
    });

    test("forwards quoteOptions and recipient", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // Without a bridge leg, options pass through but aren't consumed;
        // this confirms the wrapper doesn't drop them.
        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith(pair),
            sendAmount: BigNumber(100_000),
            recipient: "0xrec",
            quoteOptions: { nativeDrop: { amount: 1n, receiver: "0xr" } },
        });
        // With no bridge leg there's no observable effect, just no throw.
        expect(result.legs).toHaveLength(1);
    });

    test("propagates RouteUnavailableError through the wrapper", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        await expect(
            quoteRouteAmountOut({
                from: "BTC",
                to: "USDC-ETH",
                pairs: {
                    [SwapType.Submarine]: {},
                    [SwapType.Reverse]: {},
                    [SwapType.Chain]: { BTC: { "L-BTC": pair } } as never,
                } as never,
                sendAmount: BigNumber(100_000),
            }),
        ).rejects.toBeInstanceOf(RouteUnavailableError);
    });
});

describe("chain-swap fee math cross-validation (lib bigint vs host BigNumber)", () => {
    // Guards against drift between the two implementations (the lib quoter
    // mirrors src/utils/calculate.ts:36/87 in bigint math).
    test.each`
        send              | percentage | server  | userClaim
        ${100_000n}       | ${0.1}     | ${1000} | ${500}
        ${12_345_678n}    | ${0.25}    | ${500}  | ${250}
        ${1_000_000_000n} | ${0.5}     | ${2000} | ${1000}
        ${50_000n}        | ${0}       | ${500}  | ${250}
    `(
        "forward: $send sats with $percentage% (server=$server, claim=$userClaim)",
        ({ send, percentage, server, userClaim }) => {
            const pair = makeChainPair(percentage, server, userClaim);
            const libResult = applyChainPairReceiveAmount(send, pair);
            const hostResult = BigInt(
                calculateReceiveAmount(
                    BigNumber(send.toString()),
                    percentage,
                    server + userClaim,
                    HostSwapType.Chain,
                ).toFixed(0),
            );
            expect(libResult).toBe(hostResult);
        },
    );

    test.each`
        receive        | percentage | server  | userClaim
        ${98_400n}     | ${0.1}     | ${1000} | ${500}
        ${12_300_000n} | ${0.25}    | ${500}  | ${250}
        ${99_999n}     | ${0.5}     | ${2000} | ${1000}
        ${49_250n}     | ${0}       | ${500}  | ${250}
    `(
        "reverse: $receive received needs ? sent (percentage=$percentage, server=$server, claim=$userClaim)",
        ({ receive, percentage, server, userClaim }) => {
            const pair = makeChainPair(percentage, server, userClaim);
            const libResult = applyChainPairSendAmount(receive, pair);
            const hostResult = BigInt(
                calculateSendAmount(
                    BigNumber(receive.toString()),
                    percentage,
                    server + userClaim,
                    HostSwapType.Chain,
                ).toFixed(0),
            );
            expect(libResult).toBe(hostResult);
        },
    );
});
