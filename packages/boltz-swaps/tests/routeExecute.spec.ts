import {
    AssetKind,
    GasAbstractionType,
    NetworkTransport,
    type RouteExecuteArgs,
    type RoutePlan,
    SwapType,
    createRoute,
    executeRoute,
    setBoltzSwapsConfig,
} from "boltz-swaps";

import type * as BridgeModule from "../src/bridge/index.ts";
import type * as ChainModule from "../src/chain.ts";
import type * as ClientModule from "../src/client.ts";
import type * as ContractsModule from "../src/evm/contracts.ts";
import type * as RouterClaimModule from "../src/evm/routerClaim.ts";
import type * as SenderModule from "../src/evm/sender.ts";
import type * as SwapContractsModule from "../src/evm/swapContracts.ts";

const mocks = vi.hoisted(() => ({
    requireDriverForRoute: vi.fn(),
    quoteDexAmountIn: vi.fn(),
    quoteDexAmountOut: vi.fn(),
    encodeDexQuote: vi.fn(),
    createChainSwap: vi.fn(),
    createRouterContract: vi.fn(),
    buildSwapContractsForAsset: vi.fn(),
    sendPopulatedTransaction: vi.fn(),
    executeChainSwap: vi.fn(),
}));

vi.mock("../src/bridge/index.ts", async (importActual) => ({
    ...(await importActual<typeof BridgeModule>()),
    bridgeRegistry: { requireDriverForRoute: mocks.requireDriverForRoute },
}));

vi.mock("../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    quoteDexAmountIn: mocks.quoteDexAmountIn,
    quoteDexAmountOut: mocks.quoteDexAmountOut,
    encodeDexQuote: mocks.encodeDexQuote,
    createChainSwap: mocks.createChainSwap,
}));

vi.mock("../src/evm/contracts.ts", async (importActual) => ({
    ...(await importActual<typeof ContractsModule>()),
    createRouterContract: mocks.createRouterContract,
}));

vi.mock("../src/evm/swapContracts.ts", async (importActual) => ({
    ...(await importActual<typeof SwapContractsModule>()),
    buildSwapContractsForAsset: mocks.buildSwapContractsForAsset,
}));

vi.mock("../src/evm/sender.ts", async (importActual) => ({
    ...(await importActual<typeof SenderModule>()),
    sendPopulatedTransaction: mocks.sendPopulatedTransaction,
}));

vi.mock("../src/chain.ts", async (importActual) => ({
    ...(await importActual<typeof ChainModule>()),
    executeChainSwap: mocks.executeChainSwap,
}));

// Keep the pure helpers real; only stub the signing/encoding leaves.
vi.mock("../src/evm/routerClaim.ts", async (importActual) => ({
    ...(await importActual<typeof RouterClaimModule>()),
    signErc20ClaimToRouter: vi.fn(async () => ({
        r: "0x1",
        s: "0x2",
        yParity: 0,
    })),
    signRouterClaim: vi.fn(async () => ({ r: "0x3", s: "0x4", yParity: 1 })),
    encodeRouterClaimExecuteTx: vi.fn(() => ({
        to: "0xrouter",
        data: "0xdexonly",
    })),
}));

const ROUTER = "0x9000000000000000000000000000000000000000";
const TBTC_TOKEN = "0x1000000000000000000000000000000000000000";
const USDC_TOKEN = "0x2000000000000000000000000000000000000000";
const RECIPIENT = "0x3000000000000000000000000000000000000000";
const REFUND = "0x4000000000000000000000000000000000000000";

const createdSwap = {
    id: "swap-1",
    claimDetails: {
        swapTree: {} as never,
        lockupAddress: "0xcontract",
        serverPublicKey: "02",
        timeoutBlockHeight: 12345,
        amount: 100_000,
        refundAddress: REFUND,
        claimAddress: "0xsigner",
    },
    lockupDetails: {} as never,
} as never;

const signer = {
    address: "0xsigner",
    account: { type: "local" },
    provider: { getChainId: vi.fn(async () => 42161) },
} as never;

const bridgePlan = (withDex = true): RoutePlan => ({
    from: "L-BTC",
    to: "USDC-BASE",
    chainSwap: { from: "L-BTC", to: "TBTC" },
    dex: withDex
        ? { chain: "ARB", tokenIn: TBTC_TOKEN, tokenOut: USDC_TOKEN }
        : undefined,
    bridge: { sourceAsset: "USDC-ARB", destinationAsset: "USDC-BASE" },
});

type ClaimBridgeArgs = {
    lzTokenFee: bigint;
    minAmountLd: bigint;
    outputTokenAddress: string;
    routerCalls: { target: string; value: string | bigint; callData: string }[];
};

const makeDriver = (msgFee: [bigint, bigint]) => ({
    getTransport: vi.fn(() => NetworkTransport.Evm),
    getContract: vi.fn(async () => ({ name: "bridge", address: "0xbridge" })),
    getQuotedContract: vi.fn(async () => ({})),
    buildQuoteOptions: vi.fn(async () => ({ recipient: RECIPIENT })),
    quoteSend: vi.fn(async () => ({
        sendParam: { dstEid: 1 },
        msgFee,
        minAmount: 9_000n,
    })),
    buildApprovalCall: vi.fn(async () => ({
        to: USDC_TOKEN,
        value: "0",
        data: "0xapprove",
    })),
    populateRouterClaimBridgeTransaction: vi.fn(
        async (_args: ClaimBridgeArgs) => ({
            to: "0xrouter",
            data: "0xpopulated",
        }),
    ),
});

const claimBridgeArgs = (
    driver: ReturnType<typeof makeDriver>,
): ClaimBridgeArgs => {
    const arg = driver.populateRouterClaimBridgeTransaction.mock.calls[0]?.[0];
    if (arg === undefined) {
        throw new Error("populateRouterClaimBridgeTransaction was not called");
    }
    return arg;
};

const args = (plan: RoutePlan): RouteExecuteArgs => ({
    createdSwap,
    plan,
    preimage: "11".repeat(32),
    signer,
    recipient: RECIPIENT,
    slippage: 0.01,
});

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.createRouterContract.mockReturnValue({ address: ROUTER });
    mocks.buildSwapContractsForAsset.mockResolvedValue({
        erc20Swap: { address: "0xerc20", read: { version: async () => 7 } },
    });
    mocks.sendPopulatedTransaction.mockResolvedValue("0xroutetx");
    mocks.quoteDexAmountIn.mockResolvedValue([
        { quote: "8000", data: { kind: "in" } },
    ]);
    mocks.quoteDexAmountOut.mockResolvedValue([
        { quote: "500", data: { kind: "out" } },
    ]);
    mocks.encodeDexQuote.mockResolvedValue({
        calls: [{ to: "0xdex", value: "0", data: "0xswap" }],
    });
    setBoltzSwapsConfig({
        assets: {
            TBTC: {
                type: AssetKind.ERC20,
                network: {
                    chainName: "Arbitrum",
                    symbol: "ARB",
                    gasToken: "ETH",
                    transport: NetworkTransport.Evm,
                    chainId: 42161,
                    rpcUrls: ["http://localhost"],
                },
                token: { address: TBTC_TOKEN, decimals: 8 },
            },
            RBTC: {
                type: AssetKind.EVMNative,
                network: {
                    chainName: "Rootstock",
                    symbol: "RBTC",
                    gasToken: "RBTC",
                    transport: NetworkTransport.Evm,
                    chainId: 30,
                    rpcUrls: ["http://localhost"],
                },
            },
        } as never,
    });
});

describe("executeRoute: bridge path (CCTP, no messaging fee)", () => {
    test("claims via the router with DEX + approval calls and zero lzTokenFee", async () => {
        const driver = makeDriver([0n, 0n]);
        mocks.requireDriverForRoute.mockReturnValue(driver);

        const result = await executeRoute(args(bridgePlan(true)));

        expect(result).toEqual({ claimTransactionId: "0xroutetx" });
        // No native-gas prepay leg for CCTP.
        expect(mocks.quoteDexAmountOut).not.toHaveBeenCalled();
        expect(mocks.quoteDexAmountIn).toHaveBeenCalledTimes(1);

        const claimArgs = claimBridgeArgs(driver);
        expect(claimArgs.lzTokenFee).toBe(0n);
        expect(claimArgs.outputTokenAddress).toBe(USDC_TOKEN);
        // one DEX call + one approval call
        expect(claimArgs.routerCalls).toHaveLength(2);
        expect(claimArgs.routerCalls[1]).toEqual({
            target: USDC_TOKEN,
            value: "0",
            callData: "0xapprove",
        });

        expect(mocks.sendPopulatedTransaction).toHaveBeenCalledWith(
            GasAbstractionType.Signer,
            signer,
            { to: "0xrouter", data: "0xpopulated" },
        );
    });
});

describe("executeRoute: bridge path (OFT, native messaging fee)", () => {
    test("adds a native-gas prepay leg and forwards lzTokenFee", async () => {
        const driver = makeDriver([1_000n, 42n]);
        mocks.requireDriverForRoute.mockReturnValue(driver);

        await executeRoute(args(bridgePlan(true)));

        // prepay leg quoted via amountOut against the native (zero) token
        expect(mocks.quoteDexAmountOut).toHaveBeenCalledTimes(1);
        // main trade re-quoted after deducting the prepay input
        expect(mocks.quoteDexAmountIn).toHaveBeenCalledTimes(2);

        const claimArgs = claimBridgeArgs(driver);
        expect(claimArgs.lzTokenFee).toBe(42n);
        // two DEX calls (trade + prepay) + approval
        expect(claimArgs.routerCalls).toHaveLength(3);
    });
});

describe("executeRoute: bridge path (no DEX leg)", () => {
    test("bridges the claimed asset directly with only an approval call", async () => {
        const driver = makeDriver([0n, 0n]);
        mocks.requireDriverForRoute.mockReturnValue(driver);

        await executeRoute(args(bridgePlan(false)));

        expect(mocks.quoteDexAmountIn).not.toHaveBeenCalled();
        const claimArgs = claimBridgeArgs(driver);
        expect(claimArgs.routerCalls).toHaveLength(1);
        // output token is the claimed asset itself
        expect(claimArgs.outputTokenAddress).toBe(TBTC_TOKEN);
    });
});

describe("executeRoute: DEX-only path (no bridge)", () => {
    test("claims via claimERC20Execute and sends through Alchemy", async () => {
        const plan: RoutePlan = {
            from: "L-BTC",
            to: "USDC-ARB",
            chainSwap: { from: "L-BTC", to: "TBTC" },
            dex: { chain: "ARB", tokenIn: TBTC_TOKEN, tokenOut: USDC_TOKEN },
        };

        const result = await executeRoute(args(plan));

        expect(result).toEqual({ claimTransactionId: "0xroutetx" });
        expect(mocks.requireDriverForRoute).not.toHaveBeenCalled();
        expect(mocks.sendPopulatedTransaction).toHaveBeenCalledWith(
            GasAbstractionType.Signer,
            signer,
            { to: "0xrouter", data: "0xdexonly" },
        );
    });
});

describe("executeRoute: minReceiveAmount floor", () => {
    const dexOnlyPlan: RoutePlan = {
        from: "L-BTC",
        to: "USDC-ARB",
        chainSwap: { from: "L-BTC", to: "TBTC" },
        dex: { chain: "ARB", tokenIn: TBTC_TOKEN, tokenOut: USDC_TOKEN },
    };

    test("DEX-only: pins amountOutMin to minReceiveAmount instead of the fresh quote", async () => {
        await executeRoute({ ...args(dexOnlyPlan), minReceiveAmount: 7950n });

        expect(mocks.encodeDexQuote).toHaveBeenCalledTimes(1);
        expect(mocks.encodeDexQuote.mock.calls[0]?.[3]).toBe(7950n);
    });

    test("DEX-only: derives the floor from the fresh quote when minReceiveAmount is omitted", async () => {
        await executeRoute(args(dexOnlyPlan));
        expect(mocks.encodeDexQuote.mock.calls[0]?.[3]).toBe(7920n);
    });

    test("DEX-only: throws when the fresh quote is below minReceiveAmount", async () => {
        await expect(
            executeRoute({ ...args(dexOnlyPlan), minReceiveAmount: 8500n }),
        ).rejects.toThrow(/below minReceiveAmount 8500 \(slippage exceeded\)/);
        expect(mocks.sendPopulatedTransaction).not.toHaveBeenCalled();
    });

    test("bridge path: pins the final minAmountLd to minReceiveAmount", async () => {
        const driver = makeDriver([0n, 0n]);
        mocks.requireDriverForRoute.mockReturnValue(driver);

        await executeRoute({
            ...args(bridgePlan(false)),
            minReceiveAmount: 8950n,
        });

        expect(claimBridgeArgs(driver).minAmountLd).toBe(8950n);
    });

    test("bridge path: throws when the bridge quote is below minReceiveAmount", async () => {
        const driver = makeDriver([0n, 0n]);
        mocks.requireDriverForRoute.mockReturnValue(driver);

        await expect(
            executeRoute({
                ...args(bridgePlan(false)),
                minReceiveAmount: 9500n,
            }),
        ).rejects.toThrow(/below minReceiveAmount 9500 \(slippage exceeded\)/);
    });
});

describe("createRoute", () => {
    test("plans the route and creates the chain swap to the via asset", async () => {
        mocks.createChainSwap.mockResolvedValue({ id: "created-1" });
        const pairs = {
            [SwapType.Chain]: {
                "L-BTC": { TBTC: { hash: "pair-hash-direct" } },
            },
        } as never;

        const result = await createRoute({
            from: "L-BTC",
            to: "TBTC",
            pairs,
            preimageHash: "ph",
            claimAddress: "0xsigner",
            refundPublicKey: "refundpub",
        });

        expect(result.plan.chainSwap).toEqual({ from: "L-BTC", to: "TBTC" });
        expect(result.createdSwap).toEqual({ id: "created-1" });
        expect(mocks.createChainSwap).toHaveBeenCalledWith(
            "L-BTC",
            "TBTC",
            undefined,
            "ph",
            undefined,
            "refundpub",
            "0xsigner",
            "pair-hash-direct",
        );
    });
});

describe("executeRoute: plain chain swap (no DEX, no bridge)", () => {
    test("delegates to executeChainSwap", async () => {
        mocks.executeChainSwap.mockResolvedValue({
            claimTransactionId: "0xplain",
            receiveAmount: 99n,
        });
        const plan: RoutePlan = {
            from: "L-BTC",
            to: "TBTC",
            chainSwap: { from: "L-BTC", to: "TBTC" },
        };

        const result = await executeRoute(args(plan));

        expect(result).toEqual({ claimTransactionId: "0xplain" });
        expect(mocks.executeChainSwap).toHaveBeenCalledWith(
            expect.objectContaining({
                createdSwap,
                to: "TBTC",
                claimAddress: "0xsigner",
                destination: RECIPIENT,
                signer,
            }),
        );
    });

    test("rejects native EVM claims when the recipient differs from the committed claim address", async () => {
        const plan: RoutePlan = {
            from: "L-BTC",
            to: "RBTC",
            chainSwap: { from: "L-BTC", to: "RBTC" },
        };
        const nativeCreatedSwap = {
            id: "swap-native",
            claimDetails: {
                swapTree: {} as never,
                lockupAddress: "0xcontract",
                serverPublicKey: "02",
                timeoutBlockHeight: 12345,
                amount: 100_000,
                refundAddress: REFUND,
                claimAddress: "0x5000000000000000000000000000000000000000",
            },
            lockupDetails: {} as never,
        } as never;

        await expect(
            executeRoute({
                ...args(plan),
                createdSwap: nativeCreatedSwap,
                recipient: RECIPIENT,
            }),
        ).rejects.toThrow(/cannot forward native EVM asset "RBTC"/);
        expect(mocks.executeChainSwap).not.toHaveBeenCalled();
    });
});
