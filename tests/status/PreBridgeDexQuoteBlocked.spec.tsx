import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { SwapPosition } from "boltz-swaps/types";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AlchemyCall } from "../../src/alchemy/Alchemy";
import type { Signer } from "../../src/context/Web3";
import type { sendPopulatedTransaction as sendPopulatedTransactionFn } from "../../src/utils/evmTransaction";
import {
    PreBridgeRecoveryStatus,
    type SomeSwap,
} from "../../src/utils/swapCreator";

const messageTransmitter = "0x1000000000000000000000000000000000000000";
const tokenAddress = "0x2000000000000000000000000000000000000000";
const destinationAddress = "0x3000000000000000000000000000000000000000";
const gasAbstractionAddress = "0x4000000000000000000000000000000000000000";

const [swap, setSwapSignal] = createSignal<SomeSwap | null>(null, {
    equals: false,
});
const [signer, setSigner] = createSignal<Signer | undefined>();
const getSwap = vi.fn<(id: string) => Promise<SomeSwap | null>>();
const setSwapStorage = vi.fn<(nextSwap: SomeSwap) => Promise<void>>();
const setSwap = vi.fn((nextSwap: SomeSwap | null) => {
    setSwapSignal(nextSwap);
});
const getGasAbstractionSigner = vi.fn<(asset: string) => Signer>();
const sendPopulatedTransaction = vi.fn<typeof sendPopulatedTransactionFn>();
const buildPreBridgeReverseBridgeRefundCalls = vi.fn();

vi.mock("@solidjs/router", () => ({
    useNavigate: () => vi.fn(),
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        t: (key: string) => key,
        getSwap,
        setSwapStorage,
        denomination: () => "BTC",
        separator: () => ".",
        slippage: () => 0.01,
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        swap,
        setSwap,
    }),
}));

vi.mock("../../src/context/Web3", () => ({
    useWeb3Signer: () => ({
        signer,
        getGasAbstractionSigner,
    }),
}));

vi.mock("../../src/consts/Assets", () => ({
    getAssetDisplaySymbol: (asset: string) => asset,
    getAssetNetwork: () => "Arbitrum",
    getTokenAddress: () => tokenAddress,
}));

vi.mock("../../src/utils/evmTransaction", () => ({
    sendPopulatedTransaction,
}));

type ContractTxProps = {
    signerOverride?: () => Signer | undefined;
    onClick: () => Promise<unknown>;
    buttonText: string;
    promptText?: string;
};
vi.mock("../../src/components/ContractTransaction", () => ({
    default: (props: ContractTxProps) => (
        <div>
            <p data-testid="prompt">{props.promptText}</p>
            <button
                data-testid="recover-button"
                onClick={() => void props.onClick()}>
                {props.buttonText}
            </button>
        </div>
    ),
}));

vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <button>connect-wallet</button>,
}));

vi.mock("../../src/components/RefundButton", () => ({
    buildPreBridgeReverseBridgeRefundCalls,
}));

const { default: PreBridgeDexQuoteBlocked } =
    await import("../../src/status/PreBridgeDexQuoteBlocked");

const makeSigner = (address: string) =>
    ({
        address,
        provider: {
            getChainId: vi.fn().mockResolvedValue(1),
        },
    }) as unknown as Signer;

const makeSwap = (): SomeSwap =>
    ({
        id: "swap-1",
        bridge: {
            position: SwapPosition.Pre,
            sourceAsset: "USDT0-ETH",
            destinationAsset: "USDT0",
            txHash: "0xbridge",
        },
        dex: {
            position: SwapPosition.Pre,
            hops: [
                {
                    dexDetails: {
                        chain: "1",
                        tokenIn: tokenAddress,
                        tokenOut: destinationAddress,
                    },
                },
            ],
            quoteAmount: "123",
        },
        execution: {
            preBridgeRecovery: {
                status: PreBridgeRecoveryStatus.Blocked,
                asset: "USDT0",
                amount: "123",
                receiveCall: {
                    to: messageTransmitter,
                    value: "0",
                    data: "0x1234",
                },
            },
        },
    }) as SomeSwap;

describe("PreBridgeDexQuoteBlocked", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const currentSwap = makeSwap();
        setSwapSignal(currentSwap);
        setSigner(makeSigner(destinationAddress));
        getSwap.mockResolvedValue(currentSwap);
        getGasAbstractionSigner.mockReturnValue(
            makeSigner(gasAbstractionAddress),
        );
        sendPopulatedTransaction.mockResolvedValue("0xrecovery");
        buildPreBridgeReverseBridgeRefundCalls.mockResolvedValue([
            {
                to: tokenAddress,
                value: "0",
                data: "0xabcd",
            },
        ]);
    });

    test("recovers bridged funds with receive call before transfer and marks swap recovered", async () => {
        render(() => <PreBridgeDexQuoteBlocked />);

        fireEvent.click(await screen.findByTestId("recover-button"));

        await waitFor(() => {
            expect(sendPopulatedTransaction).toHaveBeenCalled();
        });

        const calls = sendPopulatedTransaction.mock
            .calls[0][2] as AlchemyCall[];
        expect(calls).toHaveLength(2);
        expect(calls[0]).toEqual({
            to: messageTransmitter,
            value: "0",
            data: "0x1234",
        });
        expect(calls[1]).toMatchObject({
            to: tokenAddress,
            value: "0",
            data: expect.stringMatching(/^0x[0-9a-f]+$/),
        });
        await waitFor(() => {
            expect(setSwapStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    execution: {
                        preBridgeRecovery: expect.objectContaining({
                            status: PreBridgeRecoveryStatus.Recovered,
                            txHash: "0xrecovery",
                        }),
                    },
                }),
            );
        });
    });

    test("marks the swap as retrying when retrying the quote", async () => {
        render(() => <PreBridgeDexQuoteBlocked />);

        fireEvent.click(await screen.findByText("retry_quote"));

        await waitFor(() => {
            expect(setSwapStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    execution: {
                        preBridgeRecovery: expect.objectContaining({
                            status: PreBridgeRecoveryStatus.Retrying,
                        }),
                    },
                }),
            );
        });
    });
});
