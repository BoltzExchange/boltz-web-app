import type * as BridgeModule from "boltz-swaps/bridge";
import type * as ClientModule from "boltz-swaps/client";
import type { AlchemyCall } from "boltz-swaps/evm";
import type * as ContractsModule from "boltz-swaps/evm/contracts";
import type { Erc20SwapContract } from "boltz-swaps/evm/contracts";
import { erc20SwapAbi } from "boltz-swaps/generated/evm-abis";
import {
    BridgeKind,
    type LockupEvent,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import {
    type Hex,
    type TransactionRequest,
    decodeFunctionData,
    erc20Abi,
    getAddress,
    parseSignature,
} from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildErc20RefundTransaction } from "../../src/components/RefundButton";
import type { Signer } from "../../src/context/Web3";
import {
    type BridgeDetail,
    type DexDetail,
    GasAbstractionType,
} from "../../src/utils/swapCreator";

const {
    quoteDexAmountIn,
    quoteDexAmountOut,
    encodeDexQuote,
    requireDriverForRoute,
    createRouterContract,
} = vi.hoisted(() => ({
    quoteDexAmountIn: vi.fn(),
    quoteDexAmountOut: vi.fn(),
    encodeDexQuote: vi.fn(),
    requireDriverForRoute: vi.fn(),
    createRouterContract: vi.fn(),
}));

vi.mock("boltz-swaps/client", async () => {
    const actual =
        await vi.importActual<typeof ClientModule>("boltz-swaps/client");
    return {
        ...actual,
        quoteDexAmountIn,
        quoteDexAmountOut,
        encodeDexQuote,
    };
});

vi.mock("boltz-swaps/bridge", async () => {
    const actual =
        await vi.importActual<typeof BridgeModule>("boltz-swaps/bridge");
    return {
        ...actual,
        bridgeRegistry: { requireDriverForRoute },
    };
});

vi.mock("boltz-swaps/evm/contracts", async () => {
    const actual = await vi.importActual<typeof ContractsModule>(
        "boltz-swaps/evm/contracts",
    );
    return {
        ...actual,
        createRouterContract,
    };
});

const contractAddress = getAddress(
    "0x1000000000000000000000000000000000000001",
);
const tokenAddress = getAddress("0x2000000000000000000000000000000000000002");
const claimAddress = getAddress("0x3000000000000000000000000000000000000003");
const gasAbstractionAddress = getAddress(
    "0x4000000000000000000000000000000000000004",
);
const userWallet = getAddress("0x5000000000000000000000000000000000000005");
const originalSender = getAddress("0x6000000000000000000000000000000000000006");
const routerAddress = getAddress("0x7000000000000000000000000000000000000007");
const dexTokenIn = getAddress("0x8000000000000000000000000000000000000008");

const refundData: LockupEvent = {
    preimageHash: `0x${"00".repeat(32)}` as const,
    amount: 700_000_000_000_000n,
    tokenAddress,
    claimAddress,
    refundAddress: gasAbstractionAddress,
    timelock: 123n,
    logIndex: 0,
};

const signature = parseSignature(
    `0x${"11".repeat(32)}${"22".repeat(32)}1b` as const,
);

const transactionSigner = {} as Signer;
const contract = { address: contractAddress } as Erc20SwapContract;

const preDexDetails: DexDetail = {
    position: SwapPosition.Pre,
    quoteAmount: "40",
    hops: [
        {
            type: SwapType.Chain,
            from: "USDT0",
            to: "TBTC",
            dexDetails: {
                chain: "ARB",
                tokenIn: dexTokenIn,
                tokenOut: tokenAddress,
            },
        },
    ],
};

const preBridgeDetails: BridgeDetail = {
    kind: BridgeKind.Oft,
    position: SwapPosition.Pre,
    sourceAsset: "USDT0-ETH",
    destinationAsset: "USDT0",
    txHash: `0x${"aa".repeat(32)}`,
};

type BuildOverrides = Partial<
    Parameters<typeof buildErc20RefundTransaction>[0]
>;

const build = (overrides: BuildOverrides = {}) =>
    buildErc20RefundTransaction({
        gasAbstraction: GasAbstractionType.Signer,
        transactionSigner,
        contract,
        refundData,
        signature,
        slippage: 0.5,
        cooperative: true,
        commitmentRefund: true,
        ...overrides,
    });

// The two shapes the builder can return: a single transaction when there is
// nothing to batch, or the calls of a gas-abstracted batch
const buildTransaction = async (overrides: BuildOverrides = {}) => {
    const result = await build(overrides);
    expect(Array.isArray(result)).toBe(false);
    return result as TransactionRequest;
};

const buildCalls = async (overrides: BuildOverrides = {}) => {
    const result = await build(overrides);
    expect(Array.isArray(result)).toBe(true);
    return result as AlchemyCall[];
};

const decodeSwapCall = (call: { data?: Hex }) =>
    decodeFunctionData({ abi: erc20SwapAbi, data: call.data! });

const createBridgeDriver = () => ({
    getTransactionSender: vi.fn().mockResolvedValue(originalSender),
    getContract: vi.fn().mockResolvedValue({}),
    getQuotedContract: vi.fn().mockResolvedValue({}),
    quoteSend: vi.fn().mockResolvedValue({
        msgFee: [0n, 0n],
        sendParam: {},
        minAmount: 38_000_000n,
    }),
    buildApprovalCall: vi.fn().mockResolvedValue({
        to: tokenAddress,
        value: "0",
        data: "0xapproval",
    }),
    encodeRouterExecuteData: vi.fn().mockReturnValue("0xexec"),
});

describe("buildErc20RefundTransaction", () => {
    let driver: ReturnType<typeof createBridgeDriver>;

    beforeEach(() => {
        vi.clearAllMocks();

        quoteDexAmountIn.mockResolvedValue([
            { quote: "39000000", data: "0xdeadbeef" },
        ]);
        encodeDexQuote.mockResolvedValue({
            calls: [
                {
                    to: routerAddress,
                    value: "0",
                    data: "0x1234",
                },
            ],
        });

        createRouterContract.mockReturnValue({ address: routerAddress });
        driver = createBridgeDriver();
        requireDriverForRoute.mockReturnValue(driver);
    });

    test("throws when the token address is missing", async () => {
        await expect(
            build({
                refundData: { ...refundData, tokenAddress: undefined },
            }),
        ).rejects.toThrow("missing token address for ERC20 refund");
    });

    test("throws when a cooperative refund has no signature", async () => {
        await expect(build({ signature: undefined })).rejects.toThrow(
            "missing cooperative refund signature",
        );
    });

    test("returns a single transaction when gas abstraction is not signer-based", async () => {
        const result = await buildTransaction({
            gasAbstraction: GasAbstractionType.None,
            destination: userWallet,
        });

        expect(result.to).toEqual(contractAddress);
        expect(decodeSwapCall(result).functionName).toEqual(
            "refundCooperative",
        );
    });

    test("encodes commitment refunds without an explicit refund address", async () => {
        const commitment = await buildTransaction({
            gasAbstraction: GasAbstractionType.None,
        });
        const regular = await buildTransaction({
            gasAbstraction: GasAbstractionType.None,
            commitmentRefund: false,
        });

        // The commitment overload omits the refund address; msg.sender is
        // the refund address
        expect(decodeSwapCall(commitment).args).not.toContain(
            gasAbstractionAddress,
        );
        expect(decodeSwapCall(regular).args).toContain(gasAbstractionAddress);
    });

    test("encodes a timeout refund without a signature", async () => {
        const result = await buildTransaction({
            gasAbstraction: GasAbstractionType.None,
            cooperative: false,
            signature: undefined,
        });

        expect(decodeSwapCall(result).functionName).toEqual("refund");
    });

    test("appends a transfer to the destination for plain refunds", async () => {
        const calls = await buildCalls({ destination: userWallet });

        expect(calls).toHaveLength(2);
        expect(calls[0].to).toEqual(contractAddress);
        expect(calls[1].to).toEqual(tokenAddress);

        const transfer = decodeFunctionData({
            abi: erc20Abi,
            data: calls[1].data!,
        });
        expect(transfer.functionName).toEqual("transfer");
        expect(transfer.args).toEqual([userWallet, refundData.amount]);
    });

    test("skips the transfer when the destination is the refund address", async () => {
        const calls = await buildCalls({
            destination: gasAbstractionAddress.toLowerCase(),
        });

        expect(calls).toHaveLength(1);
    });

    test("falls through to a bare refund when no destination is known", async () => {
        // Documents the strand fallback: with no route and no destination the
        // refund releases funds to the on-chain refund address only. Callers
        // must gate on a known destination before sending this.
        const result = await buildTransaction({ destination: undefined });

        expect(result.to).toEqual(contractAddress);
    });

    test("routes a pre-DEX refund to the destination through the DEX", async () => {
        const calls = await buildCalls({
            dexDetails: preDexDetails,
            destination: userWallet,
        });

        expect(calls).toHaveLength(2);
        expect(calls[0].to).toEqual(contractAddress);
        expect(calls[1].to).toEqual(routerAddress);

        expect(quoteDexAmountIn).toHaveBeenCalledWith(
            "ARB",
            tokenAddress,
            dexTokenIn,
            refundData.amount,
        );
        expect(encodeDexQuote).toHaveBeenCalledWith(
            "ARB",
            userWallet,
            refundData.amount,
            expect.any(BigInt),
            "0xdeadbeef",
        );
    });

    test("throws for a routed refund without a destination", async () => {
        await expect(
            build({ dexDetails: preDexDetails, destination: undefined }),
        ).rejects.toThrow("missing refund destination for routed refund");
    });

    test("throws for a pre-bridge refund without reverse DEX details", async () => {
        await expect(
            build({ bridge: preBridgeDetails, dexDetails: undefined }),
        ).rejects.toThrow("missing reverse DEX details for pre-bridge refund");
    });

    test("bridges a pre-bridge refund back to the resolved original sender", async () => {
        const calls = await buildCalls({
            dexDetails: preDexDetails,
            bridge: preBridgeDetails,
        });

        // refund + funding transfer to the router + router execute
        expect(calls).toHaveLength(3);
        expect(calls[0].to).toEqual(contractAddress);
        expect(calls[1].to).toEqual(tokenAddress);
        expect(calls[2].to).toEqual(routerAddress);
        expect(calls[2].data).toEqual("0xexec");

        expect(driver.getTransactionSender).toHaveBeenCalledWith(
            preBridgeDetails.sourceAsset,
            preBridgeDetails.txHash,
        );
        expect(driver.quoteSend).toHaveBeenCalledWith(
            expect.anything(),
            {
                sourceAsset: preBridgeDetails.destinationAsset,
                destinationAsset: preBridgeDetails.sourceAsset,
            },
            originalSender,
            expect.any(BigInt),
        );
    });

    test("delivers locally when the bridge transaction is unknown", async () => {
        // Legacy restores may lack the bridge tx needed to resolve the
        // original sender; the refund swaps to the destination instead of
        // bridging back
        const calls = await buildCalls({
            dexDetails: preDexDetails,
            bridge: { ...preBridgeDetails, txHash: undefined },
            destination: userWallet,
        });

        expect(calls).toHaveLength(2);
        expect(calls[0].to).toEqual(contractAddress);
        expect(calls[1].to).toEqual(routerAddress);

        expect(driver.getTransactionSender).not.toHaveBeenCalled();
        expect(encodeDexQuote).toHaveBeenCalledWith(
            "ARB",
            userWallet,
            refundData.amount,
            expect.any(BigInt),
            "0xdeadbeef",
        );
    });

    test("throws without a bridge transaction or a destination", async () => {
        await expect(
            build({
                dexDetails: preDexDetails,
                bridge: { ...preBridgeDetails, txHash: undefined },
                destination: undefined,
            }),
        ).rejects.toThrow("missing refund destination for routed refund");
    });
});
