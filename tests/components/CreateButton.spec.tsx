import { render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import CreateButton from "../../src/components/CreateButton";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";

describe("CreateButton", () => {
    test("should render CreateButton", () => {
        render(() => <CreateButton />, {
            wrapper: contextWrapper,
        });
    });

    test("should initially be disabled with minimum label", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        signals.setMinimum(50_000);
        const btn = (await screen.findByText(
            i18n.en.minimum_amount
                .replace("{{ amount }}", "50 000")
                .replace("{{ denomination }}", "sats"),
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });

    test("should be enabled with create_swap label", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setValid(true);
        signals.setAmountValid(true);
        signals.setAddressValid(true);
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
    });

    test("should be disabled with api_offline label", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(false);
        const btn = (await screen.findByText(
            i18n.en.api_offline,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });

    test("should be disabled on invalid address", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setAddressValid(true);
        signals.setAssetReceive(BTC);
        signals.setAssetSend(LBTC);
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
        signals.setAddressValid(false);
        expect(btn.disabled).toBeTruthy();
        const label = i18n.en.invalid_address.replace("{{ asset }}", "BTC");
        expect(btn.textContent).toEqual(label);
    });

    test("should be disabled on invalid invoice", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoiceValid(true);
        signals.setAssetSend(LBTC);
        signals.setAssetReceive(LN);
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
        signals.setInvoiceValid(false);
        expect(btn.disabled).toBeTruthy();
        expect(btn.textContent).toEqual(i18n.en.invalid_invoice);
    });
});
