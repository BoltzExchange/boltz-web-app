import { Router } from "@solidjs/router";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, test } from "vitest";

import RefundButton from "../../src/components/RefundButton";
import { Web3SignerProvider } from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";

describe("RefundButton", () => {
    test("should render RefundButton", async () => {
        const [swap] = createSignal(null);
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <RefundButton swap={swap} />
                </Web3SignerProvider>
            </Router>
        ));
        const input = (await screen.findByTestId(
            "refundAddress",
        )) as HTMLInputElement;
        expect(input).not.toBeUndefined();
        expect(input.disabled).toBeTruthy();

        const button = (await screen.findByText(
            i18n.en.refund,
        )) as HTMLButtonElement;
        expect(button).not.toBeUndefined();
        expect(button.disabled).toBeTruthy();
    });

    test("button should be active after pasting valid address", async () => {
        const [swap] = createSignal({
            asset: "BTC",
        });
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <RefundButton swap={swap} />
                </Web3SignerProvider>
            </Router>
        ));
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

    test("button should be inactive after pasting in address", async () => {
        const [swap] = createSignal({
            asset: "BTC",
        });
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <RefundButton swap={swap} />
                </Web3SignerProvider>
            </Router>
        ));
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
