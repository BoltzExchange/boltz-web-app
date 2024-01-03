import { fireEvent, render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { describe, expect, test, vi } from "vitest";

import InvoiceInput from "../../src/components/InvoiceInput";
import * as signals from "../../src/signals";
import {
    invoiceValid,
    receiveAmount,
    sendAmount,
    setReceiveAmount,
    setReverse,
    setSendAmount,
} from "../../src/signals";
import {
    decodeInvoice,
    extractInvoice,
    invoicePrefix,
} from "../../src/utils/invoice";

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
        setReverse(false);

        render(() => <InvoiceInput />);

        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        expect(invoiceValid()).toEqual(expected);
    });

    test("should set amount based on invoice", async () => {
        setReverse(false);

        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        render(() => <InvoiceInput />);

        const invoice =
            "lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";
        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        expect(setReceiveAmount).toHaveBeenLastCalledWith(
            BigNumber(decodeInvoice(invoice).satoshis),
        );
    });

    test("should clear invoice on amount change", async () => {
        setReverse(false);

        render(() => <InvoiceInput />);

        const setInvoice = vi.spyOn(signals, "setInvoice");

        const invoice =
            "lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";

        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        expect(setInvoice).toHaveBeenCalledTimes(1);
        expect(setInvoice).toHaveBeenCalledWith(invoice);

        setReceiveAmount(receiveAmount().plus(1));

        expect(setInvoice).toHaveBeenCalledTimes(2);
        expect(setInvoice).toHaveBeenCalledWith("");
    });

    test.each`
        lnurl
        ${"m@some.domain"}
        ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
    `("should not clear lnurl $lnurl on amount change", async ({ lnurl }) => {
        setReverse(false);

        render(() => <InvoiceInput />);

        const input = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        const setLnurl = vi.spyOn(signals, "setLnurl");

        fireEvent.input(input, {
            target: { value: lnurl },
        });

        expect(setLnurl).toHaveBeenCalledTimes(1);
        expect(setLnurl).toHaveBeenCalledWith(lnurl.toLowerCase());

        setSendAmount(sendAmount().plus(1));

        expect(input.value).toEqual(lnurl);
    });

    test("should remove prefix of invoices", async () => {
        const invoice =
            "lightning:lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";

        setReverse(false);

        render(() => <InvoiceInput />);

        const input = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        const setInvoice = vi.spyOn(signals, "setInvoice");

        fireEvent.input(input, {
            target: { value: invoice },
        });

        expect(setInvoice).toHaveBeenCalledWith(extractInvoice(invoice));
    });

    test.each`
        lnurl
        ${`${invoicePrefix}m@some.domain`}
        ${`${invoicePrefix}LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH`}
    `("should remove prefix of lnurl $lnurl", async ({ lnurl }) => {
        setReverse(false);

        render(() => <InvoiceInput />);

        const input = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        const setLnurl = vi.spyOn(signals, "setLnurl");

        fireEvent.input(input, {
            target: { value: lnurl },
        });

        expect(setLnurl).toHaveBeenCalledWith(extractInvoice(lnurl));
    });
});
