import { fireEvent, render, screen } from "@solidjs/testing-library";

import InvoiceInput from "../../src/components/InvoiceInput";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { extractInvoice, invoicePrefix } from "../../src/utils/invoice";
import { TestComponent, contextWrapper, signals } from "../helper";
import { wait } from "../utils";

describe("InvoiceInput", () => {
    test.each`
        expected | invoice
        ${false} | ${"m@some.domain"}
        ${false} | ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
        ${false} | ${"invalid"}
        ${false} | ${""}
    `("should validate invoice $invoice", async ({ invoice, expected }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );
        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);
        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        await wait(100);
        expect(signals.invoiceValid()).toEqual(expected);
    });

    test.each`
        lnurl
        ${"m@some.domain"}
        ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
    `("should not clear lnurl $lnurl on amount change", async ({ lnurl }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );
        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        const input = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(input, {
            target: { value: lnurl },
        });

        expect(signals.lnurl()).toEqual(lnurl.toLowerCase());

        signals.setSendAmount(signals.sendAmount().plus(1));

        expect(input.value).toEqual(lnurl);
    });

    test.each`
        lnurl
        ${`${invoicePrefix}m@some.domain`}
        ${`${invoicePrefix}LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH`}
    `("should remove prefix of lnurl $lnurl", async ({ lnurl }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );
        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        const input = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(input, {
            target: { value: lnurl },
        });

        expect(signals.lnurl()).toEqual(extractInvoice(lnurl));
    });

    test.each`
        asset   | input
        ${BTC}  | ${"bcrt1q7vq47xpsg4t080205edaulc3sdsjpdxy9svhr3"}
        ${LBTC} | ${"el1qq2yjqfz9evc3c5m0rzw0cdtfcdfl5kmcf9xsskpsgza34zhezxzq7y6y4dnldxhtd935k8dn63n8cywy3jlzuvftycsmytjmu"}
    `("should switch asset based on input $input", async ({ asset, input }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const invoiceInput = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(invoiceInput, {
            target: { value: input },
        });

        expect(signals.assetSend()).toEqual(LN);
        expect(signals.assetReceive()).toEqual(asset);
        expect(signals.onchainAddress()).toEqual(input);
    });
});
