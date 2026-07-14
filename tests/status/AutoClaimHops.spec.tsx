import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type * as BoltzClientModule from "boltz-swaps/client";
import type * as BoltzContractsModule from "boltz-swaps/evm/contracts";
import { SwapPosition, SwapType } from "boltz-swaps/types";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Signer } from "../../src/context/Web3";
import type * as EvmTransactionModule from "../../src/utils/evmTransaction";
import type { ClaimQuote } from "../../src/utils/quoter";
import type * as SwapCreatorModule from "../../src/utils/swapCreator";
import { GasAbstractionType, type SomeSwap } from "../../src/utils/swapCreator";

const signerAddress = "0x3000000000000000000000000000000000000000";

const [swap, setSwapSignal] = createSignal<SomeSwap | null>(null, {
    equals: false,
});
const [signer, setSigner] = createSignal<Signer | undefined>();
const getSwap = vi.fn<(id: string) => Promise<SomeSwap | null>>();
const notify = vi.fn();
const modifySwap = vi.fn();
const getErc20Swap = vi.fn();
const getGasAbstractionSigner = vi.fn();
const fetchDexQuote = vi.fn<(...args: unknown[]) => Promise<ClaimQuote>>();
const sendPopulatedTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();
const claimAsset =
    vi.fn<
        (args: {
            amount: number;
        }) => Promise<{ transactionHash: string; receiveAmount: bigint }>
    >();

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        t: (key: string) => key,
        slippage: () => 0.01,
        notify,
        getSwap,
        denomination: () => "sat",
        separator: () => ".",
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({ swap }),
}));

vi.mock("../../src/context/Web3", () => ({
    useWeb3Signer: () => ({
        getEtherSwap: vi.fn(),
        getErc20Swap,
        signer,
        getGasAbstractionSigner,
    }),
}));

vi.mock("../../src/hooks/useModifySwap", () => ({
    useModifySwap: () => modifySwap,
}));

vi.mock("../../src/utils/quoter", () => ({
    fetchDexQuote,
    gasTopUpSupported: () => false,
    getGasTopUpNativeAmount: vi.fn(),
    fetchGasTokenQuote: vi.fn(),
}));

vi.mock("boltz-swaps/evm", () => ({
    satsToAssetAmount: (amount: number) => BigInt(amount),
    dexCalldataToRouterCalls: () => [],
    signErc20ClaimToRouter: () => Promise.resolve("0xclaimsignature"),
    signRouterClaim: () => Promise.resolve("0xroutersignature"),
    encodeRouterClaimExecuteTx: () => ({
        to: "0x4000000000000000000000000000000000000000",
        data: "0x",
    }),
}));

vi.mock("boltz-swaps/evm/contracts", async (importOriginal) => ({
    ...(await importOriginal<typeof BoltzContractsModule>()),
    createRouterContract: () => ({
        address: "0x4000000000000000000000000000000000000000",
    }),
}));

vi.mock("boltz-swaps/client", async (importOriginal) => ({
    ...(await importOriginal<typeof BoltzClientModule>()),
    encodeDexQuote: () => Promise.resolve("0xdexcalldata"),
}));

vi.mock("../../src/utils/evmTransaction", async (importOriginal) => ({
    ...(await importOriginal<typeof EvmTransactionModule>()),
    claimAsset: (...args: Parameters<typeof claimAsset>) => claimAsset(...args),
    sendPopulatedTransaction: (...args: unknown[]) =>
        sendPopulatedTransaction(...args),
}));

vi.mock("../../src/utils/swapCreator", async (importOriginal) => ({
    ...(await importOriginal<typeof SwapCreatorModule>()),
    getFinalAssetReceive: () => "USDT0",
}));

vi.mock("../../src/components/ContractTransaction", () => ({
    default: () => null,
}));

const { AutoClaimHops, ClaimEvm } =
    await import("../../src/status/TransactionConfirmed");

const makeSigner = (address: string) =>
    ({
        address,
        provider: { getChainId: vi.fn().mockResolvedValue(42161) },
    }) as unknown as Signer;

const makeQuote = (amountOut: bigint): ClaimQuote => ({
    trade: { amountIn: 1_000_000n, amountOut, data: {} },
});

const dexDetail = {
    position: SwapPosition.Post,
    hops: [
        {
            from: "USDT0",
            dexDetails: {
                chain: "42161",
                tokenIn: "0x1000000000000000000000000000000000000000",
                tokenOut: "0x2000000000000000000000000000000000000000",
            },
        },
    ],
    quoteAmount: "1000000",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const renderAutoClaimHops = (dex = dexDetail) =>
    render(() => (
        <AutoClaimHops
            swapId="swap-1"
            gasAbstraction={GasAbstractionType.Signer}
            preimage="0xpreimage"
            assetSend="USDT0"
            assetReceive="USDT0"
            signerAddress={signerAddress}
            refundAddress={signerAddress}
            timeoutBlockHeight={100}
            getGasToken={false}
            dex={dex}
            autoClaimEnabled={true}
        />
    ));

describe("AutoClaimHops", () => {
    // Amounts must come from storage, so a stale prop with a zeroed quote
    // amount must not change any behavior
    const staleDexDetail = { ...dexDetail, quoteAmount: "0" };

    beforeEach(() => {
        vi.clearAllMocks();
        setSwapSignal({ id: "swap-1", sendAmount: 1_000 } as SomeSwap);
        setSigner(makeSigner(signerAddress));
        getGasAbstractionSigner.mockReturnValue(makeSigner(signerAddress));
        getSwap.mockResolvedValue({
            id: "swap-1",
            sendAmount: 1_000,
            claimDetails: { amount: 991 },
            dex: dexDetail,
        } as SomeSwap);
        sendPopulatedTransaction.mockResolvedValue("0xclaimtx");
    });

    test("prompts for approval when the fresh quote is below the persisted slippage threshold", async () => {
        fetchDexQuote.mockResolvedValue(makeQuote(500_000n));

        renderAutoClaimHops(staleDexDetail);

        expect(
            await screen.findByText("dex_quote_changed"),
        ).toBeInTheDocument();
        expect(getSwap).toHaveBeenCalledWith("swap-1");
        expect(sendPopulatedTransaction).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
    });

    test("accepting the changed quote triggers the claim", async () => {
        fetchDexQuote.mockResolvedValue(makeQuote(500_000n));

        renderAutoClaimHops();

        fireEvent.click(await screen.findByText("accept"));

        await waitFor(() => expect(getSwap).toHaveBeenCalledWith("swap-1"));
        await waitFor(() =>
            expect(sendPopulatedTransaction).toHaveBeenCalledTimes(1),
        );
        await waitFor(() =>
            expect(screen.queryByText("dex_quote_changed")).toBeNull(),
        );
        expect(notify).not.toHaveBeenCalled();
    });

    test("auto-claims the persisted amount without prompting when the fresh quote is within tolerance", async () => {
        fetchDexQuote.mockResolvedValue(makeQuote(2_000_000n));

        renderAutoClaimHops(staleDexDetail);

        await waitFor(() => expect(fetchDexQuote).toHaveBeenCalled());
        expect(fetchDexQuote.mock.calls[0][1]).toBe(991n);
        await waitFor(() =>
            expect(sendPopulatedTransaction).toHaveBeenCalledTimes(1),
        );
        expect(screen.queryByText("dex_quote_changed")).toBeNull();
        expect(notify).not.toHaveBeenCalled();
    });

    test("fails closed without requesting a DEX quote when persisted amounts are zero", async () => {
        getSwap.mockResolvedValue({
            id: "swap-1",
            claimDetails: { amount: 0 },
            dex: staleDexDetail,
        } as SomeSwap);

        renderAutoClaimHops(staleDexDetail);

        expect(
            await screen.findByText(/has invalid persisted claim state/),
        ).toBeInTheDocument();
        expect(getSwap).toHaveBeenCalledTimes(1);
        expect(fetchDexQuote).not.toHaveBeenCalled();
        expect(sendPopulatedTransaction).not.toHaveBeenCalled();
    });
});

describe("ClaimEvm", () => {
    const renderClaimEvm = () =>
        render(() => (
            <ClaimEvm
                swapId="swap-1"
                gasAbstraction={GasAbstractionType.Signer}
                preimage="0xpreimage"
                assetSend="BTC"
                assetReceive="USDT0"
                signerAddress={signerAddress}
                claimAddress={signerAddress}
                refundAddress={signerAddress}
                timeoutBlockHeight={100}
                finalReceive="USDT0"
                getGasToken={false}
                autoClaimEnabled={true}
            />
        ));

    beforeEach(() => {
        vi.clearAllMocks();
        setSigner(makeSigner(signerAddress));
        claimAsset.mockResolvedValue({
            transactionHash: "0xclaimtx",
            receiveAmount: 991n,
        });
    });

    test("auto-claims a reverse swap with its persisted onchain amount", async () => {
        getSwap.mockResolvedValue({
            id: "swap-1",
            type: SwapType.Reverse,
            onchainAmount: 777,
        } as SomeSwap);

        renderClaimEvm();

        await waitFor(() => expect(claimAsset).toHaveBeenCalledTimes(1));
        expect(getSwap).toHaveBeenCalledWith("swap-1");
        expect(claimAsset.mock.calls[0][0].amount).toBe(777);
    });

    test("fails closed on a zero persisted amount and claims on retry once it is positive", async () => {
        getSwap.mockResolvedValue({
            id: "swap-1",
            type: SwapType.Chain,
            claimDetails: { amount: 0 },
        } as SomeSwap);

        renderClaimEvm();

        expect(
            await screen.findByText(/has invalid persisted claim state/),
        ).toBeInTheDocument();
        expect(claimAsset).not.toHaveBeenCalled();

        getSwap.mockResolvedValue({
            id: "swap-1",
            type: SwapType.Chain,
            claimDetails: { amount: 991 },
        } as SomeSwap);
        fireEvent.click(screen.getByText("retry"));

        await waitFor(() => expect(claimAsset).toHaveBeenCalledTimes(1));
        expect(claimAsset.mock.calls[0][0].amount).toBe(991);
        expect(
            screen.queryByText(/has invalid persisted claim state/),
        ).toBeNull();
    });
});
