import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { BTC } from "../../src/consts";
import { calculateSendAmount } from "../../src/utils/calculate";
import { cfg } from "../config";
import {
    TestComponent,
    contextWrapper,
    createContext,
    globalSignals,
} from "../helper";

describe("Fees component", () => {
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
        globalSignals.setPairs(cfg);
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
        globalSignals.setPairs(cfg);
        expect(createContext.minimum()).toEqual(
            cfg.submarine[BTC][BTC].limits.minimal,
        );
        expect(createContext.maximum()).toEqual(
            cfg.submarine[BTC][BTC].limits.maximal,
        );

        createContext.setReverse(false);

        expect(createContext.minimum()).toEqual(
            calculateSendAmount(
                BigNumber(cfg.submarine[BTC][BTC].limits.minimal),
                createContext.boltzFee(),
                createContext.minerFee(),
                createContext.reverse(),
            ).toNumber(),
        );
        expect(createContext.maximum()).toEqual(
            calculateSendAmount(
                BigNumber(cfg.submarine[BTC][BTC].limits.maximal),
                createContext.boltzFee(),
                createContext.minerFee(),
                createContext.reverse(),
            ).toNumber(),
        );
    });
});
