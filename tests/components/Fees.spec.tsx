import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { describe, expect, test } from "vitest";

import Fees from "../../src/components/Fees";
import { CreateProvider, useCreateContext } from "../../src/context/Create";
import { GlobalProvider, useGlobalContext } from "../../src/context/Global";
import { calculateSendAmount } from "../../src/utils/calculate";
import { cfg } from "../config";

describe("Fees component", () => {
    let signals: any;
    let globalSignals: any;

    const TestComponent = () => {
        signals = useCreateContext();
        globalSignals = useGlobalContext();
        return "";
    };

    test("should render", async () => {
        render(() => (
            <GlobalProvider>
                <CreateProvider>
                    <TestComponent />
                    <Fees />
                </CreateProvider>
            </GlobalProvider>
        ));
        globalSignals.setConfig(cfg);
    });

    test("should recalculate limits on direction switch", () => {
        render(() => (
            <GlobalProvider>
                <CreateProvider>
                    <TestComponent />
                    <Fees />
                </CreateProvider>
            </GlobalProvider>
        ));
        globalSignals.setConfig(cfg);

        expect(signals.minimum()).toEqual(cfg["BTC/BTC"].limits.minimal);
        expect(signals.maximum()).toEqual(cfg["BTC/BTC"].limits.maximal);

        signals.setReverse(false);

        expect(signals.minimum()).toEqual(
            calculateSendAmount(
                BigNumber(cfg["BTC/BTC"].limits.minimal),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ).toNumber(),
        );
        expect(signals.maximum()).toEqual(
            calculateSendAmount(
                BigNumber(cfg["BTC/BTC"].limits.maximal),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ).toNumber(),
        );
    });
});
