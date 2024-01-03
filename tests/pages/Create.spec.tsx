import { Router } from "@solidjs/router";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { sideReceive, sideSend } from "../../src/consts";
import { Web3SignerProvider } from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";
import Create from "../../src/pages/Create";
import * as signals from "../../src/signals";
import { calculateReceiveAmount } from "../../src/utils/calculate";
import { cfg } from "../config";

describe("Create", () => {
    let signals: any;

    const TestComponent = () => {
        signals = useCreateContext();
        return "";
    };

    beforeAll(() => {
        setConfig(cfg);
        setDenomination("sat");
    });

    test("should render Create", async () => {
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <CreateProvider>
                        <TestComponent />
                        <Create />
                    </CreateProvider>
                </Web3SignerProvider>
            </Router>
        ));
        signals.setReverse(true);
        signals.setAsset(BTC);
        const button = await screen.findAllByText(i18n.en.create_swap);
        expect(button).not.toBeUndefined();
    });

    test("should update receive amount on asset change", async () => {
        // const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <CreateProvider>
                        <TestComponent />
                        <Create />
                    </CreateProvider>
                </Web3SignerProvider>
            </Router>
        ));
        signals.setMinimum(cfg["BTC/BTC"].limits.minimal);
        signals.setReverse(true);
        signals.setAsset(BTC);

        signals.setSendAmount(BigNumber(50_000));

        // To force trigger a recalculation
        signals.setAsset(LBTC);
        signals.setAsset(BTC);

        expect(signals.receiveAmount()).toEqual(BigNumber(38110));

        signals.setAsset(LBTC);

        expect(signals.receiveAmount()).toEqual(BigNumber(49447));
    });

    test("should update receive amount on miner fee change", async () => {
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <CreateProvider>
                        <TestComponent />
                        <Create />
                    </CreateProvider>
                </Web3SignerProvider>
            </Router>
        ));

        signals.setMinimum(cfg["BTC/BTC"].limits.minimal);
        signals.setReverse(true);
        signals.setSendAmount(BigNumber(50_000));

        // To force trigger a recalculation
        signals.setAsset(LBTC);
        signals.setAsset(BTC);

        expect(signals.receiveAmount()).toEqual(BigNumber(38110));

        cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;

        const updatedCfg = { ...cfg };
        setConfig(updatedCfg);

        expect(signals.receiveAmount()).toEqual(BigNumber(38110 - 1));
    });

    test("should update calculated value on fee change", async () => {
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <CreateProvider>
                        <TestComponent />
                        <Create />
                    </CreateProvider>
                </Web3SignerProvider>
            </Router>
        ));
        signals.setReverse(true);
        signals.setAsset("BTC");

        const updateConfig = () => {
            const updatedCfg = { ...cfg };
            cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
            setConfig(updatedCfg);
        };

        const amount = 100_000;
        fireEvent.input(await screen.findByTestId("receiveAmount"), {
            target: { value: amount },
        });

        expect(signals.amountChanged()).toEqual(sideReceive);
        expect(signals.sendAmount()).not.toEqual(BigNumber(amount));
        expect(signals.receiveAmount()).toEqual(BigNumber(amount));

        updateConfig();

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: amount },
        });

        expect(signals.amountChanged()).toEqual(sideSend);
    });

    test.each`
        extrema
        ${"min"}
        ${"max"}
    `("should set $extrema amount on click", async ({ extrema }) => {
        render(() => (
            <Router>
                <Web3SignerProvider noFetch={true}>
                    <CreateProvider>
                        <TestComponent />
                        <Create />
                    </CreateProvider>
                </Web3SignerProvider>
            </Router>
        ));

        const cfgMinimum = cfg["BTC/BTC"].limits.minimal;
        signals.setMinimum(cfgMinimum);
        signals.setReverse(true);
        signals.setAsset("BTC");

        const amount =
            extrema === "min" ? signals.minimum() : signals.maximum();

        fireEvent.click(await screen.findByText(amount));

        expect(setSendAmount).toHaveBeenCalledTimes(1);
        expect(setSendAmount).toHaveBeenCalledWith(BigNumber(amount));

        expect(setReceiveAmount).toHaveBeenCalledTimes(1);
        expect(setReceiveAmount).toHaveBeenCalledWith(
            calculateReceiveAmount(
                BigNumber(amount),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ),
        );
    });
});
