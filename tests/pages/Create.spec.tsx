import { Router } from "@solidjs/router";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { describe, expect, test } from "vitest";

import { sideReceive, sideSend } from "../../src/consts";
import { CreateProvider, useCreateContext } from "../../src/context/Create";
import { GlobalProvider, useGlobalContext } from "../../src/context/Global";
import { Web3SignerProvider } from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";
import Create from "../../src/pages/Create";
import { calculateReceiveAmount } from "../../src/utils/calculate";
import { cfg } from "../config";

describe("Create", () => {
    let signals: any;
    let globalSignals: any;
    const TestComponent = () => {
        signals = useCreateContext();
        globalSignals = useGlobalContext();
        return "";
    };

    test("should render Create", async () => {
        render(() => (
            <Router>
                <GlobalProvider>
                    <Web3SignerProvider noFetch={true}>
                        <CreateProvider>
                            <TestComponent />
                            <Create />
                        </CreateProvider>
                    </Web3SignerProvider>
                </GlobalProvider>
            </Router>
        ));
        const button = await screen.findAllByText(i18n.en.create_swap);
        expect(button).not.toBeUndefined();
    });

    test("should update receive amount on asset change", async () => {
        render(() => (
            <Router>
                <GlobalProvider>
                    <Web3SignerProvider noFetch={true}>
                        <CreateProvider>
                            <TestComponent />
                            <Create />
                        </CreateProvider>
                    </Web3SignerProvider>
                </GlobalProvider>
            </Router>
        ));

        globalSignals.setConfig(cfg);
        signals.setReverse(true);
        signals.setAsset("BTC");
        signals.setSendAmount(BigNumber(50_000));

        // To force trigger a recalculation
        signals.setAsset("L-BTC");
        signals.setAsset("BTC");

        expect(signals.receiveAmount()).toEqual(BigNumber(38110));

        signals.setAsset("L-BTC");

        expect(signals.receiveAmount()).toEqual(BigNumber(49447));
    });

    test("should update receive amount on miner fee change", async () => {
        render(() => (
            <Router>
                <GlobalProvider>
                    <Web3SignerProvider noFetch={true}>
                        <CreateProvider>
                            <TestComponent />
                            <Create />
                        </CreateProvider>
                    </Web3SignerProvider>
                </GlobalProvider>
            </Router>
        ));

        globalSignals.setConfig(cfg);
        signals.setReverse(true);
        signals.setAsset("BTC");
        signals.setSendAmount(BigNumber(50_000));

        // // To force trigger a recalculation
        signals.setAsset("L-BTC");
        signals.setAsset("BTC");

        expect(signals.receiveAmount()).toEqual(BigNumber(38110));

        const updatedCfg = { ...cfg };
        cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
        globalSignals.setConfig(updatedCfg);

        expect(signals.receiveAmount()).toEqual(BigNumber(38110 - 1));
    });

    test("should update calculated value on fee change", async () => {
        render(() => (
            <Router>
                <GlobalProvider>
                    <Web3SignerProvider noFetch={true}>
                        <CreateProvider>
                            <TestComponent />
                            <Create />
                        </CreateProvider>
                    </Web3SignerProvider>
                </GlobalProvider>
            </Router>
        ));

        globalSignals.setConfig(cfg);
        signals.setMinimum(cfg["BTC/BTC"].limits.minimal);
        signals.setReverse(true);
        signals.setAsset("BTC");

        const updateConfig = () => {
            const updatedCfg = { ...cfg };
            cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
            globalSignals.setConfig(updatedCfg);
        };

        const amount = 100_000;
        fireEvent.input(await screen.findByTestId("receiveAmount"), {
            target: { value: amount },
        });

        expect(signals.amountChanged()).toEqual(sideReceive);

        expect(signals.sendAmount()).toEqual(BigNumber(112203));
        expect(signals.receiveAmount()).toEqual(BigNumber(amount));

        updateConfig();

        expect(signals.sendAmount()).toEqual(BigNumber(112204));
        expect(signals.receiveAmount()).toEqual(BigNumber(amount));

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: amount },
        });

        expect(signals.amountChanged()).toEqual(sideSend);

        expect(signals.sendAmount()).toEqual(BigNumber(amount));
        expect(signals.receiveAmount()).toEqual(BigNumber(87858));

        updateConfig();

        expect(signals.sendAmount()).toEqual(BigNumber(amount));
        expect(signals.receiveAmount()).toEqual(BigNumber(87857));
    });

    test.each`
        extrema
        ${"min"}
        ${"max"}
    `("should set $extrema amount on click", async (extrema) => {
        render(() => (
            <Router>
                <GlobalProvider>
                    <Web3SignerProvider noFetch={true}>
                        <CreateProvider>
                            <TestComponent />
                            <Create />
                        </CreateProvider>
                    </Web3SignerProvider>
                </GlobalProvider>
            </Router>
        ));

        const amount =
            extrema === "min" ? signals.minimum() : signals.maximum();

        fireEvent.click(await screen.findByText(amount));

        expect(signals.sendAmount()).toEqual(BigNumber(amount));
        expect(signals.receiveAmount()).toEqual(
            calculateReceiveAmount(
                BigNumber(amount),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ),
        );
    });
});
