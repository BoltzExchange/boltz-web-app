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
    beforeAll(() => {
        signals.setDenomination("sat");
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

        signals.setSendAmount(BigNumber(50_000));

        // To force trigger a recalculation
        signals.setAsset("L-BTC");
        signals.setAsset("BTC");

        expect(setReceiveAmount).toHaveBeenCalledWith(BigNumber(38110));

        signals.setAsset("L-BTC");

        expect(setReceiveAmount).toHaveBeenLastCalledWith(BigNumber(49447));
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

        expect(setReceiveAmount).toHaveBeenCalledWith(BigNumber(38110));

        const updatedCfg = { ...cfg };
        cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
        signals.setConfig(updatedCfg);

        expect(setReceiveAmount).toHaveBeenLastCalledWith(BigNumber(38110 - 1));
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
        expect(setSendAmount).not.toHaveBeenCalledWith(BigNumber(amount));
        expect(setReceiveAmount).toHaveBeenCalledTimes(1);
        expect(setReceiveAmount).toHaveBeenCalledWith(BigNumber(amount));

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
        expect(setSendAmount).toHaveBeenCalledWith(BigNumber(amount));

        expect(setReceiveAmount).toHaveBeenCalledTimes(1);
        expect(setReceiveAmount).toHaveBeenCalledWith(
            BigNumber(calculateReceiveAmount(amount)),
        );
    });
});
