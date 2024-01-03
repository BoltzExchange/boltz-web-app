import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

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

    test("should recalculate limits on direction switch", () => {
        render(() => (
            <CreateProvider>
                <TestComponent />
                <Fees />
            </CreateProvider>
        ));

        setConfig(cfg);
        signals.setReverse(true);
        signals.setAsset("BTC");

        const limits = cfg["BTC/BTC"].limits;

        expect(signals.minimum()).toEqual(limits.minimal);
        expect(signals.maximum()).toEqual(limits.maximal);

        signals.setReverse(false);

        expect(setMinimum).toHaveBeenLastCalledWith(
            calculateSendAmount(
                BigNumber(cfg["BTC/BTC"].limits.minimal),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ).toNumber(),
        );
        expect(setMaximum).toHaveBeenLastCalledWith(
            calculateSendAmount(
                BigNumber(cfg["BTC/BTC"].limits.maximal),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ).toNumber(),
        );
    });
});
