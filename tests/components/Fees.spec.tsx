import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { beforeAll, describe, expect, test } from "vitest";

import Fees from "../../src/components/Fees";
import { CreateProvider, useCreateContext } from "../../src/context/Create";
import { setConfig } from "../../src/signals";
import { calculateSendAmount } from "../../src/utils/calculate";
import { cfg } from "../config";

describe("Fees component", () => {
    let signals: any;

    const TestComponent = () => {
        signals = useCreateContext();
        return "";
    };

    beforeAll(() => {
        setConfig(cfg);
    });

    test("should render", async () => {
        render(() => (
            <CreateProvider>
                <TestComponent />
                <Fees />
            </CreateProvider>
        ));
    });

    test("should recalculate limits on direction switch", () => {
        render(() => (
            <CreateProvider>
                <TestComponent />
                <Fees />
            </CreateProvider>
        ));

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
