import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
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

        signals.setAssetReceive(BTC);
        signals.setAssetSend(LN);

        expect(pairs.submarine[BTC][BTC].limits.minimal).toEqual(
            signals.minimum(),
        );
        expect(pairs.submarine[BTC][BTC].limits.maximal).toEqual(
            signals.maximum(),
        );

        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        expect(signals.minimum()).toEqual(
            calculateSendAmount(
                BigNumber(pairs.submarine[BTC][BTC].limits.minimal),
                signals.boltzFee(),
                signals.minerFee(),
                SwapType.Submarine,
            ).toNumber(),
        );
        expect(signals.maximum()).toEqual(
            calculateSendAmount(
                BigNumber(pairs.submarine[BTC][BTC].limits.maximal),
                signals.boltzFee(),
                signals.minerFee(),
                SwapType.Submarine,
            ).toNumber(),
        );
    });

    test("should increase the miner fee for reverse swaps by 1 when sending to an unconfidential Liquid address", () => {
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
        signals.setAssetSend(LN);
        signals.setAssetReceive(LBTC);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "ert1q2vf850cshpedhvn9x0lv33j8az4ela04afuzp0",
        );

        const fees = pairs.reverse[BTC][LBTC].fees;
        expect(signals.minerFee()).toEqual(
            fees.minerFees.lockup + fees.minerFees.claim + 1,
        );
    });

    test("should increase the miner fee for chain swaps by 1 when sending to an unconfidential Liquid address", () => {
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
        signals.setAssetSend(BTC);
        signals.setAssetReceive(LBTC);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "ert1q2vf850cshpedhvn9x0lv33j8az4ela04afuzp0",
        );

        const fees = pairs.chain[BTC][LBTC].fees;
        expect(signals.minerFee()).toEqual(
            fees.minerFees.server + fees.minerFees.user.claim + 1,
        );
    });
});
