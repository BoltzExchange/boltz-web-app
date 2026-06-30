import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";
import { SwapType } from "boltz-swaps/types";
import { type Accessor, type Setter, createSignal } from "solid-js";

import RefundButton from "../../src/components/RefundButton";
import { BTC, LN } from "../../src/consts/Assets";
import { getSwapUTXOs } from "../../src/utils/blockchain";
import { refund } from "../../src/utils/rescue";
import type { ChainSwap, SubmarineSwap } from "../../src/utils/swapCreator";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    payContext,
} from "../helper";

vi.mock("../../src/utils/rescue", async () => {
    const actual = await vi.importActual("../../src/utils/rescue");
    return { ...actual, refund: vi.fn() };
});
vi.mock("../../src/utils/blockchain", async () => {
    const actual = await vi.importActual("../../src/utils/blockchain");
    return { ...actual, getSwapUTXOs: vi.fn() };
});

const mockRefund = vi.mocked(refund);
const mockGetSwapUTXOs = vi.mocked(getSwapUTXOs);

const validAddress = "2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp";

const renderRefundButton = (swap: SubmarineSwap | ChainSwap) => {
    const [swapAccessor] = createSignal<SubmarineSwap | ChainSwap>(swap);
    render(
        () => (
            <>
                <TestComponent />
                <RefundButton
                    swap={swapAccessor}
                    setRefundTxId={(() => "") as Setter<string>}
                />
            </>
        ),
        { wrapper: contextWrapper },
    );
};

const submitRefund = async () => {
    const input = (await screen.findByTestId(
        "refundAddress",
    )) as HTMLInputElement;
    fireEvent.input(input, { target: { value: validAddress } });
    const button = (await screen.findByTestId(
        "refundButton",
    )) as HTMLButtonElement;
    fireEvent.click(button);
};

describe("RefundButton", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should render RefundButton", () => {
        const [swap] = createSignal<SubmarineSwap | ChainSwap | null>(null);
        render(
            () => (
                <RefundButton
                    swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                    setRefundTxId={(() => "") as Setter<string>}
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );
    });

    test("button should be active after pasting valid address", async () => {
        const [swap] = createSignal<SubmarineSwap | ChainSwap>({
            version: OutputType.Taproot,
            id: "swap",
            assetSend: BTC,
            assetReceive: LN,
            type: SwapType.Submarine,
        } as SubmarineSwap);
        render(
            () => (
                <>
                    <TestComponent />
                    <RefundButton
                        swap={swap}
                        setRefundTxId={(() => "") as Setter<string>}
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setRefundableUTXOs([{ hex: "0x0" }]);
        const input = (await screen.findByTestId(
            "refundAddress",
        )) as HTMLInputElement;
        expect(input.disabled).not.toBeTruthy();

        fireEvent.input(input, {
            target: {
                value: "2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp",
            },
        });

        const button = (await screen.findByTestId(
            "refundButton",
        )) as HTMLButtonElement;
        expect(button.disabled).not.toBeTruthy();
    });

    test("button should be inactive after pasting the lock address", async () => {
        const lockupAddress = "2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp";
        const [swap] = createSignal<SubmarineSwap | ChainSwap>({
            version: 1,
            date: 1620000000,
            id: "swap",
            assetSend: BTC,
            assetReceive: BTC,
            sendAmount: 10000,
            receiveAmount: 10000,
            type: SwapType.Submarine,
            address: lockupAddress,
            bip21: `bitcoin:${lockupAddress}?amount=0.0001`,
            swapTree: {},
        } as SubmarineSwap);
        render(
            () => (
                <>
                    <TestComponent />
                    <RefundButton
                        swap={swap}
                        setRefundTxId={(() => "") as Setter<string>}
                    />
                    ,
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setRefundableUTXOs([{ hex: "0x0" }]);
        const input = (await screen.findByTestId(
            "refundAddress",
        )) as HTMLInputElement;
        expect(input.disabled).not.toBeTruthy();

        fireEvent.input(input, {
            target: {
                value: lockupAddress,
            },
        });

        const button = (await screen.findByTestId(
            "refundButton",
        )) as HTMLButtonElement;
        expect(button.disabled).toBeTruthy();
    });

    test("button should be inactive after pasting an invalid address", async () => {
        const [swap] = createSignal<SubmarineSwap | ChainSwap>({
            version: OutputType.Taproot,
            id: "swap",
            assetSend: BTC,
            assetReceive: LN,
            type: SwapType.Submarine,
        } as SubmarineSwap);
        render(
            () => (
                <>
                    <TestComponent />
                    <RefundButton
                        swap={swap}
                        setRefundTxId={(() => "") as Setter<string>}
                    />
                    ,
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setRefundableUTXOs([{ hex: "0x0" }]);
        const input = (await screen.findByTestId(
            "refundAddress",
        )) as HTMLInputElement;
        expect(input.disabled).not.toBeTruthy();

        const button = (await screen.findByTestId(
            "refundButton",
        )) as HTMLButtonElement;

        fireEvent.input(input, {
            target: {
                value: "XXXQ5FhU2497BryFfUgbqkAJE87aKHUhXMp",
            },
        });

        expect(button.disabled).toBeTruthy();
    });

    test("self-heals a stale lockup outpoint and retries the refund once", async () => {
        mockRefund
            .mockRejectedValueOnce(
                "No such mempool or blockchain transaction. ID: phantom",
            )
            .mockRejectedValueOnce(
                "No such mempool or blockchain transaction. ID: real",
            );
        mockGetSwapUTXOs.mockResolvedValue([
            { id: "real-utxo", hex: "real-hex" },
        ]);

        renderRefundButton({
            version: OutputType.Taproot,
            id: "swap",
            assetSend: BTC,
            assetReceive: LN,
            type: SwapType.Submarine,
        } as SubmarineSwap);
        payContext.setRefundableUTXOs([{ id: "stale-utxo", hex: "stale-hex" }]);

        await submitRefund();

        await waitFor(() => expect(mockRefund).toHaveBeenCalledTimes(2));
        expect(mockGetSwapUTXOs).toHaveBeenCalledTimes(1);
        expect(payContext.refundableUTXOs()).toEqual([
            { id: "real-utxo", hex: "real-hex" },
        ]);
    });

    test("does not retry when the explorer returns the same outpoint", async () => {
        mockRefund.mockRejectedValue(
            "No such mempool or blockchain transaction. ID: stale",
        );
        mockGetSwapUTXOs.mockResolvedValue([
            { id: "stale-utxo", hex: "fresh-hex" },
        ]);

        renderRefundButton({
            version: OutputType.Taproot,
            id: "swap",
            assetSend: BTC,
            assetReceive: LN,
            type: SwapType.Submarine,
        } as SubmarineSwap);
        payContext.setRefundableUTXOs([{ id: "stale-utxo", hex: "stale-hex" }]);

        await submitRefund();

        await waitFor(() =>
            expect(globalSignals.notificationType()).toBe("error"),
        );
        expect(mockRefund).toHaveBeenCalledTimes(1);
        expect(mockGetSwapUTXOs).toHaveBeenCalledTimes(1);
    });

    test("self-heals on a non-string refund error (bogus lockup tx)", async () => {
        mockRefund.mockRejectedValue(new Error("invalid lockup tx hex"));
        mockGetSwapUTXOs.mockResolvedValue([
            { id: "real-utxo", hex: "real-hex" },
        ]);

        renderRefundButton({
            version: OutputType.Taproot,
            id: "swap",
            assetSend: BTC,
            assetReceive: LN,
            type: SwapType.Submarine,
        } as SubmarineSwap);
        payContext.setRefundableUTXOs([{ id: "bogus", hex: "bogus" }]);

        await submitRefund();

        await waitFor(() => expect(mockRefund).toHaveBeenCalledTimes(2));
        expect(payContext.refundableUTXOs()).toEqual([
            { id: "real-utxo", hex: "real-hex" },
        ]);
    });
});
