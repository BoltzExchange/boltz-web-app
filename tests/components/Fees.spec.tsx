import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { BTC } from "../../src/consts";
import { useCreateContext } from "../../src/context/Create";
import { useGlobalContext } from "../../src/context/Global";
import { calculateSendAmount } from "../../src/utils/calculate";
import { contextWrapper } from "../helper";
import { pairs } from "../pairs";

describe("Fees component", () => {
    let signals: any;
    let globalSignals: any;

    const TestComponent = () => {
        signals = useCreateContext();
        globalSignals = useGlobalContext();
        return "";
    };

    test("should render", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setPairs(pairs);
    });

    test("should recalculate limits on direction switch", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setPairs(pairs);

        expect(signals.minimum()).toEqual(
            pairs.submarine[BTC][BTC].limits.minimal,
        );
        expect(signals.maximum()).toEqual(
            pairs.submarine[BTC][BTC].limits.maximal,
        );

        signals.setReverse(false);

        expect(signals.minimum()).toEqual(
            calculateSendAmount(
                BigNumber(pairs.submarine[BTC][BTC].limits.minimal),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ).toNumber(),
        );
        expect(signals.maximum()).toEqual(
            calculateSendAmount(
                BigNumber(pairs.submarine[BTC][BTC].limits.maximal),
                signals.boltzFee(),
                signals.minerFee(),
                signals.reverse(),
            ).toNumber(),
        );
    });
});
