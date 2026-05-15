import {
    type ChainPairTypeTaproot,
    type Pairs,
    type QuoteData,
    RouteUnavailableError,
    applyChainPairReceiveAmount,
    applyChainPairSendAmount,
    createBoltzClient,
    quoteRouteAmountIn,
    quoteRouteAmountOut,
    setBoltzSwapsConfig,
} from "boltz-swaps";
import {
    AssetKind,
    BridgeKind,
    CctpTransferMode,
    NetworkTransport,
    SwapType,
} from "boltz-swaps/types";

import type * as RegistryModule from "../src/bridge/registry.ts";
import type * as FetcherModule from "../src/http/fetcher.ts";

const { fetcherMock, fakeDriver, bridgeRegistryMock } = vi.hoisted(() => {
    const fakeDriver = {
        quoteReceiveAmount: vi.fn(),
        quoteAmountInForAmountOut: vi.fn(),
    };
    return {
        fetcherMock: vi.fn(),
        fakeDriver,
        bridgeRegistryMock: {
            requireDriverForRoute: vi.fn(() => fakeDriver),
        },
    };
});

vi.mock("../src/http/fetcher.ts", async (importActual) => ({
    ...(await importActual<typeof FetcherModule>()),
    fetcher: fetcherMock,
}));

vi.mock("../src/bridge/registry.ts", async (importActual) => ({
    ...(await importActual<typeof RegistryModule>()),
    bridgeRegistry: bridgeRegistryMock,
}));

const makeChainPair = (
    percentage: number,
    serverFee: number,
    userClaimFee: number,
    userLockupFee = 0,
): ChainPairTypeTaproot => ({
    hash: "h",
    rate: 1,
    limits: { minimal: 1, maximal: 1_000_000_000, maximalZeroConf: 0 },
    fees: {
        percentage,
        minerFees: {
            server: serverFee,
            user: { claim: userClaimFee, lockup: userLockupFee },
        },
    },
});

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

const fixtureAssets = () => ({
    BTC: { type: AssetKind.UTXO },
    "TBTC-ETH": {
        type: AssetKind.ERC20,
        network: baseEvmNetwork("ETH"),
        token: { address: "0xTBTC_ETH", decimals: 8 },
    },
    "USDC-ETH": {
        type: AssetKind.ERC20,
        network: baseEvmNetwork("ETH"),
        token: { address: "0xUSDC_ETH", decimals: 6, routeVia: "TBTC-ETH" },
        bridge: {
            kind: BridgeKind.Cctp as const,
            canonicalAsset: "USDC-ETH",
            cctp,
        },
    },
    "USDC-BASE": {
        type: AssetKind.ERC20,
        network: baseEvmNetwork("BASE"),
        token: { address: "0xUSDC_BASE", decimals: 6 },
        bridge: {
            kind: BridgeKind.Cctp as const,
            canonicalAsset: "USDC-ETH",
            cctp,
        },
    },
    "USDC-ARB": {
        type: AssetKind.ERC20,
        network: baseEvmNetwork("ARB"),
        token: { address: "0xUSDC_ARB", decimals: 6 },
        bridge: {
            kind: BridgeKind.Cctp as const,
            canonicalAsset: "USDC-ETH",
            cctp,
        },
    },
    "USDT0-ETH": {
        type: AssetKind.ERC20,
        network: baseEvmNetwork("ETH"),
        token: { address: "0xUSDT0_ETH", decimals: 6, routeVia: "TBTC-ETH" },
        bridge: {
            kind: BridgeKind.Oft as const,
            canonicalAsset: "USDT0-ETH",
        },
    },
    "USDT0-OP": {
        type: AssetKind.ERC20,
        network: baseEvmNetwork("OP"),
        token: { address: "0xUSDT0_OP", decimals: 6 },
        bridge: {
            kind: BridgeKind.Oft as const,
            canonicalAsset: "USDT0-ETH",
        },
    },
});

const installAssets = () => {
    setBoltzSwapsConfig({
        boltzApiUrl: "https://test",
        assets: fixtureAssets() as never,
    });
};

const pairsWith = (
    table: Record<string, Record<string, ChainPairTypeTaproot>>,
): Pairs => ({
    [SwapType.Submarine]: {},
    [SwapType.Reverse]: {},
    [SwapType.Chain]: table,
});

const dexQuote = (quote: string, data: unknown = {}): QuoteData => ({
    quote,
    data,
});

beforeEach(() => {
    fetcherMock.mockReset();
    fakeDriver.quoteReceiveAmount.mockReset();
    fakeDriver.quoteAmountInForAmountOut.mockReset();
    bridgeRegistryMock.requireDriverForRoute.mockReset();
    bridgeRegistryMock.requireDriverForRoute.mockImplementation(
        () => fakeDriver,
    );
    installAssets();
});

describe("applyChainPair fee math", () => {
    test("forward: percentage + miner fee with ceiling", () => {
        // sendAmount=100_000, percentage=0.1%, miner=server(1000)+user.claim(500)=1500
        // percentageFee = ceil(100_000 * 0.001) = 100
        // receive = 100_000 - 100 - 1500 = 98_400
        expect(
            applyChainPairReceiveAmount(
                100_000n,
                makeChainPair(0.1, 1000, 500),
            ),
        ).toBe(98_400n);
    });

    test("forward: clamps to zero when fees exceed input", () => {
        expect(
            applyChainPairReceiveAmount(100n, makeChainPair(0.1, 1000, 500)),
        ).toBe(0n);
    });

    test("forward: zero percentage matches plain subtraction", () => {
        expect(
            applyChainPairReceiveAmount(10_000n, makeChainPair(0, 200, 100)),
        ).toBe(9_700n);
    });

    test("forward: fractional percentage rounds up", () => {
        // sendAmount=1234, percentage=0.5%, miner=0
        // percentageFee = ceil(1234 * 0.005) = ceil(6.17) = 7
        // receive = 1234 - 7 = 1227
        expect(
            applyChainPairReceiveAmount(1234n, makeChainPair(0.5, 0, 0)),
        ).toBe(1227n);
    });

    test("reverse: inverse of forward within one unit", () => {
        const pair = makeChainPair(0.1, 1000, 500);
        for (const send of [50_000n, 100_000n, 1_000_000n, 12_345_678n]) {
            const received = applyChainPairReceiveAmount(send, pair);
            const back = applyChainPairSendAmount(received, pair);
            // Ceiling on both directions can introduce a one-unit gap.
            expect(back - send).toBeGreaterThanOrEqual(0n);
            expect(back - send).toBeLessThanOrEqual(2n);
        }
    });

    test("reverse: zero percentage matches plain addition", () => {
        expect(
            applyChainPairSendAmount(10_000n, makeChainPair(0, 200, 100)),
        ).toBe(10_300n);
    });

    test("reverse: 98400 receive yields 100000 send for 0.1% pair", () => {
        expect(
            applyChainPairSendAmount(98_400n, makeChainPair(0.1, 1000, 500)),
        ).toBe(100_000n);
    });

    test("forward: ignores user.lockup (paid on source chain)", () => {
        const a = applyChainPairReceiveAmount(
            100_000n,
            makeChainPair(0.1, 1000, 500, 0),
        );
        const b = applyChainPairReceiveAmount(
            100_000n,
            makeChainPair(0.1, 1000, 500, 9999),
        );
        expect(a).toBe(b);
    });
});

describe("quoteRouteAmountOut: leg planning", () => {
    test("direct chain-swap to canonical: 1-leg, no DEX, no bridge", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // USDC-ETH is 6 decimals: chain-swap math runs in sats (98400 sats
        // after fees), then converted to USDC-ETH base units = 98400/10^2 = 984.
        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountIn: 100_000n,
        });

        expect(result.legs).toHaveLength(1);
        expect(result.legs[0]).toMatchObject({
            kind: "chain-swap",
            from: "BTC",
            to: "USDC-ETH",
            sendAmount: 100_000n,
            receiveAmount: 984n,
        });
        expect(result.sendAmount).toBe(100_000n);
        expect(result.receiveAmount).toBe(984n);
        expect(fetcherMock).not.toHaveBeenCalled();
        expect(bridgeRegistryMock.requireDriverForRoute).not.toHaveBeenCalled();
    });

    test("DEX hop when no direct pair exists: 2-leg, no bridge", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        fetcherMock.mockResolvedValue([dexQuote("97000")]);
        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "TBTC-ETH": pair } }),
            amountIn: 100_000n,
        });

        expect(result.legs).toHaveLength(2);
        expect(result.legs[0]).toMatchObject({
            kind: "chain-swap",
            to: "TBTC-ETH",
            sendAmount: 100_000n,
            receiveAmount: 98_400n,
        });
        expect(result.legs[1]).toMatchObject({
            kind: "dex",
            chain: "ETH",
            tokenIn: "0xTBTC_ETH",
            tokenOut: "0xUSDC_ETH",
            amountIn: 98_400n,
            amountOut: 97_000n,
        });
        expect(result.receiveAmount).toBe(97_000n);
        expect(fetcherMock).toHaveBeenCalledWith(
            expect.stringContaining(
                "/v2/quote/ETH/in?tokenIn=0xTBTC_ETH&tokenOut=0xUSDC_ETH&amountIn=98400",
            ),
        );
    });

    test("bridge leg added when destination is a variant: 2-leg", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // 100_000 BTC sats → chain-swap → 98400 sats → USDC-ETH base = 984
        fakeDriver.quoteReceiveAmount.mockResolvedValue({
            amountIn: 984n,
            amountOut: 980n,
            messagingFee: { amount: 50n, token: "ETH" },
            bridgeLimit: [10n, 1_000_000n],
            bridgeFeeDetails: [[100n, "protocol"]],
        });

        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ARB",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountIn: 100_000n,
        });

        expect(result.legs).toHaveLength(2);
        expect(result.legs[0]).toMatchObject({ kind: "chain-swap" });
        expect(result.legs[1]).toMatchObject({
            kind: "bridge",
            amountIn: 984n,
            amountOut: 980n,
            messagingFee: { amount: 50n, token: "ETH" },
            bridgeLimit: [10n, 1_000_000n],
        });
        expect(result.receiveAmount).toBe(980n);
        expect(bridgeRegistryMock.requireDriverForRoute).toHaveBeenCalledWith({
            sourceAsset: "USDC-ETH",
            destinationAsset: "USDC-ARB",
        });
        expect(fakeDriver.quoteReceiveAmount).toHaveBeenCalledWith(
            { sourceAsset: "USDC-ETH", destinationAsset: "USDC-ARB" },
            984n,
            undefined,
        );
    });

    test("full 3-leg: BTC chain swap to TBTC-ETH, DEX to USDT0-ETH, OFT bridge to USDT0-OP", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        fetcherMock.mockResolvedValue([dexQuote("96000")]);
        fakeDriver.quoteReceiveAmount.mockResolvedValue({
            amountIn: 96_000n,
            amountOut: 95_950n,
            messagingFee: { amount: 100n, token: "ETH" },
        });

        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDT0-OP",
            pairs: pairsWith({ BTC: { "TBTC-ETH": pair } }),
            amountIn: 100_000n,
        });

        expect(result.legs).toHaveLength(3);
        expect(result.legs[0]).toMatchObject({
            kind: "chain-swap",
            to: "TBTC-ETH",
            receiveAmount: 98_400n,
        });
        expect(result.legs[1]).toMatchObject({
            kind: "dex",
            tokenIn: "0xTBTC_ETH",
            tokenOut: "0xUSDT0_ETH",
            amountIn: 98_400n,
            amountOut: 96_000n,
        });
        expect(result.legs[2]).toMatchObject({
            kind: "bridge",
            amountIn: 96_000n,
            amountOut: 95_950n,
        });
        expect(result.receiveAmount).toBe(95_950n);
        expect(bridgeRegistryMock.requireDriverForRoute).toHaveBeenCalledWith({
            sourceAsset: "USDT0-ETH",
            destinationAsset: "USDT0-OP",
        });
    });

    test("recipient is merged into bridge quote options", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        fakeDriver.quoteReceiveAmount.mockResolvedValue({
            amountIn: 984n,
            amountOut: 980n,
        });

        await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ARB",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountIn: 100_000n,
            recipient: "0xrecipient",
            quoteOptions: { nativeDrop: { amount: 1n, receiver: "0xr" } },
        });

        expect(fakeDriver.quoteReceiveAmount).toHaveBeenCalledWith(
            { sourceAsset: "USDC-ETH", destinationAsset: "USDC-ARB" },
            984n,
            {
                nativeDrop: { amount: 1n, receiver: "0xr" },
                recipient: "0xrecipient",
            },
        );
    });

    test("captures chain-swap miner fee detail on the leg", async () => {
        const pair = makeChainPair(0.2, 1000, 500, 300);
        const result = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountIn: 100_000n,
        });
        expect(result.legs[0]).toMatchObject({
            fees: {
                percentage: 0.2,
                minerFees: {
                    server: 1000,
                    userClaim: 500,
                    userLockup: 300,
                },
            },
        });
    });
});

describe("quoteRouteAmountOut: error paths", () => {
    test("throws when no chain-swap pair and no route-via", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // BTC -> USDC-ETH but no pair for either landing or via
        await expect(
            quoteRouteAmountOut({
                from: "BTC",
                to: "USDC-ETH",
                pairs: pairsWith({ BTC: { "L-BTC": pair } }),
                amountIn: 100_000n,
            }),
        ).rejects.toThrow(RouteUnavailableError);
    });

    test("throws when route-via configured but no via-asset pair", async () => {
        // landing = USDC-ETH, routeVia points to TBTC-ETH, but no pair exists
        await expect(
            quoteRouteAmountOut({
                from: "BTC",
                to: "USDC-ETH",
                pairs: pairsWith({ BTC: {} }),
                amountIn: 100_000n,
            }),
        ).rejects.toThrow(/no chain-swap pair from BTC to via-asset/);
    });

    test("propagates bridgeRegistry errors", async () => {
        bridgeRegistryMock.requireDriverForRoute.mockImplementation(() => {
            throw new Error("no driver");
        });
        const pair = makeChainPair(0.1, 1000, 500);
        await expect(
            quoteRouteAmountOut({
                from: "BTC",
                to: "USDC-ARB",
                pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
                amountIn: 100_000n,
            }),
        ).rejects.toThrow(/no driver/);
    });

    test("throws when DEX returns no quotes", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        fetcherMock.mockResolvedValue([]);
        await expect(
            quoteRouteAmountOut({
                from: "BTC",
                to: "USDC-ETH",
                pairs: pairsWith({ BTC: { "TBTC-ETH": pair } }),
                amountIn: 100_000n,
            }),
        ).rejects.toThrow(/no DEX/);
    });
});

describe("quoteRouteAmountIn: reverse path", () => {
    test("1-leg reverse: only chain swap", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // Want 984 USDC-ETH (6 decimals) out → chain-swap sats = 984*10^2 = 98400
        // → applyChainPairSendAmount(98400, pair) = 100000 BTC sats.
        const result = await quoteRouteAmountIn({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountOut: 984n,
        });
        expect(result.legs).toHaveLength(1);
        expect(result.sendAmount).toBe(100_000n);
        expect(result.receiveAmount).toBe(984n);
        expect(result.legs[0]).toMatchObject({
            kind: "chain-swap",
            sendAmount: 100_000n,
            receiveAmount: 984n,
        });
    });

    test("2-leg reverse with bridge: uses driver.quoteAmountInForAmountOut", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        fakeDriver.quoteAmountInForAmountOut.mockResolvedValue(98_400n);
        fakeDriver.quoteReceiveAmount.mockResolvedValue({
            amountIn: 98_400n,
            amountOut: 98_300n,
        });

        const result = await quoteRouteAmountIn({
            from: "BTC",
            to: "USDC-ARB",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountOut: 98_300n,
        });

        expect(fakeDriver.quoteAmountInForAmountOut).toHaveBeenCalledWith(
            { sourceAsset: "USDC-ETH", destinationAsset: "USDC-ARB" },
            98_300n,
            undefined,
        );
        expect(result.legs).toHaveLength(2);
        expect(result.legs[0]).toMatchObject({
            kind: "chain-swap",
            receiveAmount: 98_400n,
        });
        expect(result.legs[1]).toMatchObject({
            kind: "bridge",
            amountIn: 98_400n,
            amountOut: 98_300n,
        });
    });

    test("3-leg reverse: bridge -> DEX -> chain swap", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        fakeDriver.quoteAmountInForAmountOut.mockResolvedValue(96_000n);
        fakeDriver.quoteReceiveAmount.mockResolvedValue({
            amountIn: 96_000n,
            amountOut: 95_950n,
        });
        fetcherMock.mockResolvedValue([dexQuote("98400")]);

        const result = await quoteRouteAmountIn({
            from: "BTC",
            to: "USDT0-OP",
            pairs: pairsWith({ BTC: { "TBTC-ETH": pair } }),
            amountOut: 95_950n,
        });

        expect(result.legs).toHaveLength(3);
        expect(result.legs[0]).toMatchObject({ kind: "chain-swap" });
        expect(result.legs[1]).toMatchObject({
            kind: "dex",
            amountIn: 98_400n,
            amountOut: 96_000n,
        });
        expect(result.legs[2]).toMatchObject({
            kind: "bridge",
            amountIn: 96_000n,
            amountOut: 95_950n,
        });
        expect(fetcherMock).toHaveBeenCalledWith(
            expect.stringContaining(
                "/v2/quote/ETH/out?tokenIn=0xTBTC_ETH&tokenOut=0xUSDT0_ETH&amountOut=96000",
            ),
        );
        expect(result.legs[0]).toMatchObject({
            kind: "chain-swap",
            receiveAmount: 98_400n,
        });
        // sendAmount for chain swap with receiveAmount=98400 → 100000
        expect(result.sendAmount).toBe(100_000n);
    });

    test("reverse round-trip stays within rounding tolerance", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        // Forward: 100000 BTC → 98400 USDC-ETH
        // Reverse: 98400 USDC-ETH → should require approximately 100000 BTC
        const fwd = await quoteRouteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountIn: 100_000n,
        });
        const rev = await quoteRouteAmountIn({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountOut: fwd.receiveAmount,
        });
        const drift = rev.sendAmount - fwd.sendAmount;
        expect(drift).toBeGreaterThanOrEqual(0n);
        expect(drift).toBeLessThanOrEqual(2n);
    });
});

describe("createBoltzClient route namespace", () => {
    test("boltz.route.quoteAmountOut dispatches to lib function", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        const client = createBoltzClient({
            boltzApiUrl: "https://test",
            assets: fixtureAssets() as never,
        });
        const result = await client.route.quoteAmountOut({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountIn: 100_000n,
        });
        expect(result.legs[0]).toMatchObject({
            kind: "chain-swap",
            receiveAmount: 984n,
        });
    });

    test("boltz.route.quoteAmountIn dispatches to lib function", async () => {
        const pair = makeChainPair(0.1, 1000, 500);
        const client = createBoltzClient({
            boltzApiUrl: "https://test",
            assets: fixtureAssets() as never,
        });
        const result = await client.route.quoteAmountIn({
            from: "BTC",
            to: "USDC-ETH",
            pairs: pairsWith({ BTC: { "USDC-ETH": pair } }),
            amountOut: 984n,
        });
        expect(result.sendAmount).toBe(100_000n);
    });
});
