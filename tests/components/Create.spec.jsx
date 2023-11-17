import { Router } from "@solidjs/router";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { beforeAll, beforeEach, expect, vi } from "vitest";

import Create from "../../src/Create";
import { sideReceive, sideSend } from "../../src/consts";
import { Web3SignerProvider } from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";
import * as signals from "../../src/signals";
import { invoiceValid, sendAmount, setReverse } from "../../src/signals";
import { calculateReceiveAmount } from "../../src/utils/calculate";
import { decodeInvoice } from "../../src/utils/invoice";
import { cfg } from "../config";

describe("Create", () => {
    beforeAll(() => {
        signals.setConfig(cfg);
        signals.setMinimum(cfg["BTC/BTC"].limits.minimal);
        signals.setReverse(true);
    });

    beforeEach(() => {
        signals.setAsset("BTC");
    });

    test("should render Create", async () => {
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));
        const button = await screen.findAllByText(i18n.en.create_swap);
        expect(button).not.toBeUndefined();
    });

    test("should update receive amount on asset change", async () => {
        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        signals.setSendAmount(50_000n);

        // To force trigger a recalculation
        signals.setAsset("L-BTC");
        signals.setAsset("BTC");

        expect(setReceiveAmount).toHaveBeenCalledWith(38110n);

        signals.setAsset("L-BTC");

        expect(setReceiveAmount).toHaveBeenLastCalledWith(49447n);
    });

    test("should update receive amount on miner fee change", async () => {
        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        expect(setReceiveAmount).toHaveBeenCalledWith(38110n);

        const updatedCfg = { ...cfg };
        cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
        signals.setConfig(updatedCfg);

        expect(setReceiveAmount).toHaveBeenLastCalledWith(38110n - 1n);
    });

    test("should update calculated value on fee change", async () => {
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        const updateConfig = () => {
            const updatedCfg = { ...cfg };
            cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
            signals.setConfig(updatedCfg);
        };

        const setSendAmount = vi.spyOn(signals, "setSendAmount");
        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");
        const setAmountChanged = vi.spyOn(signals, "setAmountChanged");

        const amount = 100_000;
        fireEvent.input(await screen.findByTestId("receiveAmount"), {
            target: { value: amount },
        });

        expect(setAmountChanged).toHaveBeenCalledWith(sideReceive);

        expect(setSendAmount).toHaveBeenCalledTimes(1);
        expect(setSendAmount).not.toHaveBeenCalledWith(BigInt(amount));
        expect(setReceiveAmount).toHaveBeenCalledTimes(1);
        expect(setReceiveAmount).toHaveBeenCalledWith(BigInt(amount));

        updateConfig();

        expect(setSendAmount).toHaveBeenCalledTimes(2);
        expect(setReceiveAmount).toHaveBeenCalledTimes(1);

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: amount },
        });

        expect(setAmountChanged).toHaveBeenCalledWith(sideSend);

        expect(setSendAmount).toHaveBeenCalledTimes(3);
        expect(setReceiveAmount).toHaveBeenCalledTimes(2);

        updateConfig();

        expect(setSendAmount).toHaveBeenCalledTimes(3);
        expect(setReceiveAmount).toHaveBeenCalledTimes(3);
    });

    test.each`
        expected | invoice
        ${true}  | ${"m@some.domain"}
        ${true}  | ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
        ${true}  | ${"lnbcrt10m1pjn8atkpp5l9le9e3mjsen75y552rsxv69m9jt6qe5l3qxx6k0nf4wu7kzfmtsdqqcqzzsxqyz5vqsp5w5k3t96h56qzsstcjv9rnrfhme3hccun464qc2gkqep6yszn3a6s9qyyssqg50u7zdppzcuvepkp53udce8azayp44h3y8nuppt077zplx79ua5tx9s498qswxqyuqzp9ns3a4uzzuuf39vmd3yfc65qpu4wpsagrqpqxyeyh"}
        ${true}  | ${"lnbcrt10m1pjn8atkpp5l9le9e3mjsen75y552rsxv69m9jt6qe5l3qxx6k0nf4wu7kzfmtsdqqcqzzsxqyz5vqsp5w5k3t96h56qzsstcjv9rnrfhme3hccun464qc2gkqep6yszn3a6s9qyyssqg50u7zdppzcuvepkp53udce8azayp44h3y8nuppt077zplx79ua5tx9s498qswxqyuqzp9ns3a4uzzuuf39vmd3yfc65qpu4wpsagrqpqxyeyh".toUpperCase()}
        ${true}  | ${"lightning:lnbcrt10m1pjn8atkpp5l9le9e3mjsen75y552rsxv69m9jt6qe5l3qxx6k0nf4wu7kzfmtsdqqcqzzsxqyz5vqsp5w5k3t96h56qzsstcjv9rnrfhme3hccun464qc2gkqep6yszn3a6s9qyyssqg50u7zdppzcuvepkp53udce8azayp44h3y8nuppt077zplx79ua5tx9s498qswxqyuqzp9ns3a4uzzuuf39vmd3yfc65qpu4wpsagrqpqxyeyh"}
        ${false} | ${"invalid"}
        ${false} | ${""}
    `("should validate invoice $invoice", async ({ invoice, expected }) => {
        setReverse(false);

        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        expect(invoiceValid()).toEqual(expected);
    });

    test("should set amount based on invoice", async () => {
        setReverse(false);

        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        const invoice =
            "lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";
        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        expect(setReceiveAmount).toHaveBeenLastCalledWith(
            decodeInvoice(invoice).satoshis,
        );
    });

    test("should clear invoice on amount change", async () => {
        setReverse(false);
        const setInvoice = vi.spyOn(signals, "setInvoice");

        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        const invoice =
            "lnbcrt235565340n1pjn87jmpp53jk5vw5z7n43wqyvv5ypma89xvkgahgdrvzxfn922485w2guxjasdqqcqzzsxqyz5vqsp5npwtpwa76526wcqxp66lzt43jdeqdxkud2j6ypjt2kyqscd6q4eq9qyyssquwlyf0vjsdyeck79mg5726llxxzv674xyr8ct5qgv28k62pmlr35kc2z8j96lc7ph403mgjxt9q8hzaeywmsrh4lg88uslyytvsnf5sp3lulnq";

        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        expect(setInvoice).toHaveBeenCalledTimes(1);
        expect(setInvoice).toHaveBeenCalledWith(invoice);

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: sendAmount() + 1 },
        });

        expect(setInvoice).toHaveBeenCalledTimes(2);
        expect(setInvoice).toHaveBeenCalledWith("");
    });

    test.each`
        lnurl
        ${"m@some.domain"}
        ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
    `("should not clear lnurl $lnurl on amount change", async ({ lnurl }) => {
        setReverse(false);
        const setInvoice = vi.spyOn(signals, "setInvoice");
        const setLnurl = vi.spyOn(signals, "setLnurl");

        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: lnurl },
        });

        expect(setLnurl).toHaveBeenCalledTimes(1);
        expect(setLnurl).toHaveBeenCalledWith(lnurl);

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: (sendAmount() || 1n) + 1n },
        });

        expect(setInvoice).toHaveBeenCalledTimes(1);
    });

    test.each`
        extrema
        ${"min"}
        ${"max"}
    `("should set $extrema amount on click", async (extrema) => {
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <Create />
                </Web3SignerProvider>
            </Router>
        ));

        const setSendAmount = vi.spyOn(signals, "setSendAmount");
        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        const amount =
            extrema === "min" ? signals.minimum() : signals.maximum();

        fireEvent.click(await screen.findByText(amount));

        expect(setSendAmount).toHaveBeenCalledTimes(1);
        expect(setSendAmount).toHaveBeenCalledWith(amount);

        expect(setReceiveAmount).toHaveBeenCalledTimes(1);
        expect(setReceiveAmount).toHaveBeenCalledWith(
            calculateReceiveAmount(amount),
        );
    });
});
