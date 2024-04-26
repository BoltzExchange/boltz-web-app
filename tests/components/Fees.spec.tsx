import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { BTC, LBTC } from "../../src/consts";
import { calculateSendAmount } from "../../src/utils/calculate";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs } from "../pairs";

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

    test("should increase the miner fee by 1 when sending to an unconfidential Liquid address", () => {
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
        signals.setAsset(LBTC);
        signals.setReverse(true);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "ert1q2vf850cshpedhvn9x0lv33j8az4ela04afuzp0",
        );

        const fees = pairs.reverse[BTC][LBTC].fees;
        expect(signals.minerFee()).toEqual(
            fees.minerFees.lockup + fees.minerFees.claim + 1,
        );
    });
});
