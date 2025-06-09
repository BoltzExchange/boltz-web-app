import { fireEvent, render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { Side, SwapType } from "../../src/consts/Enums";
import { Denomination } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import Create from "../../src/pages/Create";
import { calculateReceiveAmount } from "../../src/utils/calculate";
import { formatAmount } from "../../src/utils/denomination";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs } from "../pairs";

vi.mock("../../src/utils/boltzClient", () => ({
    getPairs: vi.fn(() => Promise.resolve(pairs)),
}));

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

    test("should update receive amount on asset change", () => {
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

        globalSignals.setPairs(pairs);
        signals.setAssetSend(LN);
        signals.setAssetReceive(BTC);
        signals.setSendAmount(BigNumber(50_000));

        // To force trigger a recalculation
        signals.setAssetReceive(LBTC);
        signals.setAssetReceive(BTC);

        expect(signals.receiveAmount()).toEqual(BigNumber(38110));

        signals.setAssetReceive(LBTC);

        expect(signals.receiveAmount()).toEqual(BigNumber(49447));
    });

    test("should update receive amount on miner fee change", () => {
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

        globalSignals.setPairs(pairs);
        signals.setAssetSend(LN);
        signals.setAssetReceive(BTC);
        signals.setSendAmount(BigNumber(50_000));

        // // To force trigger a recalculation
        signals.setAssetReceive(LBTC);
        signals.setAssetReceive(BTC);

        expect(signals.receiveAmount()).toEqual(BigNumber(38110));

        const updatedCfg = { ...pairs };
        pairs.reverse[BTC][BTC].fees.minerFees.claim += 1;
        globalSignals.setPairs(updatedCfg);

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

        globalSignals.setPairs(pairs);
        signals.setMinimum(pairs.reverse[BTC][BTC].limits.minimal);
        signals.setAssetSend(LN);
        signals.setAssetReceive(BTC);

        const updateConfig = () => {
            const updatedCfg = { ...pairs };
            pairs.reverse[BTC][BTC].fees.minerFees.claim += 1;
            globalSignals.setPairs(updatedCfg);
        };

        const amount = 100_000;
        fireEvent.input(await screen.findByTestId("receiveAmount"), {
            target: { value: amount },
        });

        expect(signals.amountChanged()).toEqual(Side.Receive);

        expect(signals.sendAmount()).toEqual(BigNumber(112203));
        expect(signals.receiveAmount()).toEqual(BigNumber(amount));

        updateConfig();

        expect(signals.sendAmount()).toEqual(BigNumber(112204));
        expect(signals.receiveAmount()).toEqual(BigNumber(amount));

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: amount },
        });

        expect(signals.amountChanged()).toEqual(Side.Send);

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
    `("should set $extrema amount on click", async ({ extrema }) => {
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

        globalSignals.setPairs(pairs);

        const amount =
            extrema === "min" ? signals.minimum() : signals.maximum();

        const formattedAmount = formatAmount(
            BigNumber(amount),
            Denomination.Sat,
            globalSignals.separator(),
        );
        fireEvent.click(await screen.findByText(formattedAmount));

        expect(signals.sendAmount()).toEqual(BigNumber(amount));
        expect(signals.receiveAmount()).toEqual(
            calculateReceiveAmount(
                BigNumber(amount),
                signals.boltzFee(),
                signals.minerFee(),
                SwapType.Reverse,
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
        globalSignals.setPairs(pairs);
        signals.setAssetSend(LN);
        signals.setAssetReceive(BTC);

        const sendAmountInput = await screen.findByTestId("sendAmount");
        fireEvent.input(sendAmountInput, {
            target: {
                value: `${pairs.reverse["BTC"]["BTC"].limits.minimal}`,
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
        globalSignals.setOnline(true);

        expect(createButton.disabled).toEqual(true);
        expect(createButton.innerHTML).toEqual("Invalid BTC address");

        fireEvent.input(sendAmountInput, {
            target: {
                value: "1",
            },
        });

        expect(createButton.disabled).toEqual(true);
        expect(createButton.innerHTML).toEqual("Minimum amount is 50 000 sats");
    });

    test("should allow comma in pasted amounts", async () => {
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
        globalSignals.setPairs(pairs);
        globalSignals.setSeparator(".");
        globalSignals.setDenomination(Denomination.Sat);
        signals.setAssetSend(LN);
        signals.setAssetReceive(BTC);

        const sendAmountInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;
        fireEvent.input(sendAmountInput, {
            target: {
                value: `0,01`,
            },
        });

        expect(globalSignals.denomination()).toEqual(Denomination.Btc);
        expect(globalSignals.separator()).toEqual(".");
        expect(sendAmountInput.value).toEqual("0.01");
    });
});
