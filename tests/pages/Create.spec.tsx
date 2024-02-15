import { fireEvent, render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import { BTC, LN, sideReceive, sideSend } from "../../src/consts";
import i18n from "../../src/i18n/i18n";
import Create from "../../src/pages/Create";
import { calculateReceiveAmount } from "../../src/utils/calculate";
import { cfg } from "../config";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";

describe("Create", () => {
    test("should render Create", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        const button = await screen.findAllByText(i18n.en.create_swap);
        expect(button).not.toBeUndefined();
    });

    test("should show WASM error", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setWasmSupported(false);
        expect(
            await screen.findAllByText(i18n.en.error_wasm),
        ).not.toBeUndefined();
    });

    test("should update receive amount on asset change", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

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
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setConfig(cfg);
        signals.setReverse(true);
        signals.setAsset("BTC");
        signals.setSendAmount(BigNumber(50_000));

        // // To force trigger a recalculation
        signals.setAsset("L-BTC");
        signals.setAsset("BTC");

        expect(signals.receiveAmount()).toEqual(BigNumber(38110));

        const updatedCfg = { ...cfg };
        cfg.reverse[BTC][BTC].fees.minerFees.claim += 1;
        globalSignals.setConfig(updatedCfg);

        expect(signals.receiveAmount()).toEqual(BigNumber(38110 - 1));
    });

    test("should update calculated value on fee change", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setConfig(cfg);
        signals.setMinimum(cfg.reverse[BTC][BTC].limits.minimal);
        signals.setReverse(true);
        signals.setAsset("BTC");

        const updateConfig = () => {
            const updatedCfg = { ...cfg };
            cfg.reverse[BTC][BTC].fees.minerFees.claim += 1;
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
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setConfig(cfg);

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

    test("should prioritize amount errors", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setConfig(cfg);
        signals.setAssetSend(LN);
        signals.setAssetReceive(BTC);

        const sendAmountInput = await screen.findByTestId("sendAmount");
        fireEvent.input(sendAmountInput, {
            target: {
                value: `${cfg.reverse["BTC"]["BTC"].limits.minimal}`,
            },
        });

        const addressButton = await screen.findByTestId("onchainAddress");
        fireEvent.input(addressButton, {
            target: {
                value: "invalid address",
            },
        });

        const createButton = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;
        expect(createButton.disabled).toEqual(true);
        expect(createButton.innerHTML).toEqual("Invalid BTC address");

        fireEvent.input(sendAmountInput, {
            target: {
                value: "1",
            },
        });

        expect(createButton.disabled).toEqual(true);
        expect(createButton.innerHTML).toEqual("Minimum amount is 50000 sat");
    });
});
