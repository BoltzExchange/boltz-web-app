import { fireEvent, render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import InvoiceInput from "../../src/components/InvoiceInput";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import {
    decodeInvoice,
    extractInvoice,
    invoicePrefix,
} from "../../src/utils/invoice";
import { TestComponent, contextWrapper, signals } from "../helper";
import { wait } from "../utils";

describe("InvoiceInput", () => {
    test.each`
        expected | invoice
        ${false} | ${"m@some.domain"}
        ${false} | ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
        ${true}  | ${"lnbcrt10m1pjn8atkpp5l9le9e3mjsen75y552rsxv69m9jt6qe5l3qxx6k0nf4wu7kzfmtsdqqcqzzsxqyz5vqsp5w5k3t96h56qzsstcjv9rnrfhme3hccun464qc2gkqep6yszn3a6s9qyyssqg50u7zdppzcuvepkp53udce8azayp44h3y8nuppt077zplx79ua5tx9s498qswxqyuqzp9ns3a4uzzuuf39vmd3yfc65qpu4wpsagrqpqxyeyh"}
        ${true}  | ${"lnbcrt10m1pjn8atkpp5l9le9e3mjsen75y552rsxv69m9jt6qe5l3qxx6k0nf4wu7kzfmtsdqqcqzzsxqyz5vqsp5w5k3t96h56qzsstcjv9rnrfhme3hccun464qc2gkqep6yszn3a6s9qyyssqg50u7zdppzcuvepkp53udce8azayp44h3y8nuppt077zplx79ua5tx9s498qswxqyuqzp9ns3a4uzzuuf39vmd3yfc65qpu4wpsagrqpqxyeyh".toUpperCase()}
        ${true}  | ${"lightning:lnbcrt10m1pjn8atkpp5l9le9e3mjsen75y552rsxv69m9jt6qe5l3qxx6k0nf4wu7kzfmtsdqqcqzzsxqyz5vqsp5w5k3t96h56qzsstcjv9rnrfhme3hccun464qc2gkqep6yszn3a6s9qyyssqg50u7zdppzcuvepkp53udce8azayp44h3y8nuppt077zplx79ua5tx9s498qswxqyuqzp9ns3a4uzzuuf39vmd3yfc65qpu4wpsagrqpqxyeyh"}
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

    test("should set amount based on invoice", async () => {
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
        const invoice =
            "lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";
        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        await wait(100);
        expect(signals.receiveAmount()).toEqual(
            BigNumber((await decodeInvoice(invoice)).satoshis),
        );
    });

    test("should clear invoice on amount change", async () => {
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

        const invoice =
            "lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";

        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        await wait(100);
        expect(signals.invoice()).toEqual(invoice);

        signals.setReceiveAmount(signals.receiveAmount().plus(1));
        await wait(100);

        expect(signals.invoice()).toEqual("");
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

    test("should remove prefix of invoices", async () => {
        const invoice =
            "lightning:lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";
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
            target: { value: invoice },
        });

        await wait(100);
        expect(signals.invoice()).toEqual(extractInvoice(invoice));
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
        ${BTC}  | ${"bcrt1p89lvl3e6e8sxmjryqx80p7cmd3l0eeh6cr48ht948wa2a0l68szqljype5"}
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
