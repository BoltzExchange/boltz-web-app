import { render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { Denomination, SwapType } from "../../src/consts/Enums";
import { getPairs } from "../../src/utils/boltzClient";
import {
    calculateReceiveAmount,
    calculateSendAmount,
} from "../../src/utils/calculate";
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

describe("Fees component", () => {
    test("should render", () => {
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
            fees.minerFees.lockup + fees.minerFees.claim + 5,
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
            fees.minerFees.server + fees.minerFees.user.claim + 5,
        );
    });

    test("should apply minimalBatched limit for liquid submarine swaps", () => {
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
        signals.setAssetSend(LBTC);
        signals.setAssetReceive(LN);
        signals.setSendAmount(BigNumber(41));
        expect(signals.minimum()).toEqual(41);
    });

    test.each`
        sendAmount
        ${1000153}
        ${0}
    `(
        "should always display fees with 8 decimal places in BTC denomination (sendAmount: $sendAmount)",
        async ({ sendAmount }) => {
            // Override pairs with custom fees for this test
            const proFee = {
                ...pairs,
                submarine: {
                    ...pairs.submarine,
                    BTC: {
                        ...pairs.submarine.BTC,
                        BTC: {
                            ...pairs.submarine.BTC.BTC,
                            fees: {
                                percentage: -0.03,
                                minerFees: 453,
                            },
                        },
                    },
                },
            };

            vi.mocked(getPairs).mockResolvedValueOnce(proFee);

            render(
                () => (
                    <>
                        <TestComponent />
                        <Fees />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            globalSignals.setDenomination(Denomination.Btc);
            signals.setAssetSend(BTC);
            signals.setAssetReceive(LN);
            signals.setSendAmount(BigNumber(sendAmount));
            signals.setReceiveAmount(
                calculateReceiveAmount(
                    BigNumber(sendAmount),
                    signals.boltzFee(),
                    signals.minerFee(),
                    SwapType.Submarine,
                ),
            );

            const networkFeeElement = (await screen.findByTestId("network-fee"))
                .textContent;
            const boltzFeeElement = (await screen.findByTestId("boltz-fee"))
                .textContent;

            const networkFeeDecimalPart = networkFeeElement.split(".")[1];
            const boltzFeeDecimalPart = boltzFeeElement.split(".")[1];

            expect(networkFeeDecimalPart).toHaveLength(8);
            expect(boltzFeeDecimalPart).toHaveLength(8);
        },
    );
});
