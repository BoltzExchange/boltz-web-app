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

const invoice =
    "lnbcrt600u1p5ynhmgpp5l8j7lnaql4mqeukvcqmhr8zp9vh3rngfgmla6km2fh9vf8pt678sdqqcqzzsxqrpwusp56gha98s9xk2f4eeyhs7dcsx4j4rt79llks72nf6l6hc9cna6vfgs9qxpqysgqqnt8lqcrujmuuv3ajvrlu5z7ydvvge4efv39hj28etf8v72vpcl597evz5e0tvq04tv3z089wxtugee4xh5hvu6309ymrfddrlzfhzgqumsrpk";

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
        signals.setOnchainAddress(
            "bcrt1qfan5dacdvedpzmweqcq0swxg7klhsh4d0qn74u",
        );
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
        signals.setOnchainAddress(
            "bcrt1qfan5dacdvedpzmweqcq0swxg7klhsh4d0qn74u",
        );
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
        signals.setInvoice(invoice);
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
        signals.setInvoiceValid(false);
        expect(btn.disabled).toBeTruthy();
        expect(btn.textContent).toEqual(i18n.en.invalid_invoice);
    });

    test("should be disabled with invalid_0_amount label", async () => {
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
        signals.setInvoice(invoice);
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
        signals.setInvoiceValid(false);
        signals.setInvoiceError("invalid_0_amount");
        expect(btn.disabled).toBeTruthy();
        expect(btn.textContent).toEqual(i18n.en.invalid_0_amount);
        signals.setAmountValid(false);
        expect(btn.disabled).toBeTruthy();
        expect(btn.textContent).toEqual(i18n.en.invalid_0_amount);
    });

    test("should be disabled on empty invoice", async () => {
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
        signals.setInvoice("");
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });

    test("should be disabled on empty address", async () => {
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
        signals.setAssetSend(LN);
        signals.setAssetReceive(LBTC);
        signals.setOnchainAddress("");
        const btn = (await screen.findByText(
            i18n.en.invalid_address.replace("{{ asset }}", "L-BTC"),
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });
});
