import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import RefundButton from "../../src/components/RefundButton";
import { contextWrapper } from "../helper";

describe("RefundButton", () => {
    test("should render RefundButton", async () => {
        const [swap] = createSignal(null);
        render(() => <RefundButton swap={swap} />, {
            wrapper: contextWrapper,
        });
    });

    test("button should be active after pasting valid address", async () => {
        const [swap] = createSignal({
            asset: "BTC",
        });
        render(() => <RefundButton swap={swap} />, {
            wrapper: contextWrapper,
        });
        const input = (await screen.findByTestId(
            "refundAddress",
        )) as HTMLInputElement;
        expect(input.disabled).not.toBeTruthy();

        // paste a valid address
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

    test("button should be inactive after pasting an invalid address", async () => {
        const [swap] = createSignal({
            asset: "BTC",
        });
        render(() => <RefundButton swap={swap} />, {
            wrapper: contextWrapper,
        });
        const input = (await screen.findByTestId(
            "refundAddress",
        )) as HTMLInputElement;
        expect(input.disabled).not.toBeTruthy();

        const button = (await screen.findByTestId(
            "refundButton",
        )) as HTMLButtonElement;

        // paste a invalid address
        fireEvent.input(input, {
            target: {
                value: "XXXQ5FhU2497BryFfUgbqkAJE87aKHUhXMp",
            },
        });

        expect(button.disabled).toBeTruthy();
    });
});
