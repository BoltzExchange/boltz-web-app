import { fireEvent, render, screen } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";
import { createSignal } from "solid-js";

import RefundButton from "../../src/components/RefundButton";
import { BTC, LN } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import { ChainSwap, SubmarineSwap } from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper, payContext } from "../helper";

describe("RefundButton", () => {
    test("should render RefundButton", () => {
        const [swap] = createSignal(null);
        render(() => <RefundButton swap={swap} />, {
            wrapper: contextWrapper,
        });
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
                    <RefundButton swap={swap} />,
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
                    <RefundButton swap={swap} />,
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
                    <RefundButton swap={swap} />,
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
});
