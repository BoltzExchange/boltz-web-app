import { render, screen, waitFor } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { Denomination, SwapType } from "../../src/consts/Enums";
import Pair from "../../src/utils/Pair";
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

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

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

    test("should recalculate limits on direction switch", async () => {
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

        setPairAssets(LN, BTC);

        await waitFor(() => {
            expect(signals.minimum()).toEqual(
                pairs.submarine[BTC][BTC].limits.minimal,
            );
            expect(signals.maximum()).toEqual(
                pairs.submarine[BTC][BTC].limits.maximal,
            );
        });

        setPairAssets(BTC, LN);

        await waitFor(() => {
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
        setPairAssets(LN, LBTC);
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
        setPairAssets(BTC, LBTC);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "ert1q2vf850cshpedhvn9x0lv33j8az4ela04afuzp0",
        );

        const fees = pairs.chain[BTC][LBTC].fees;
        expect(signals.minerFee()).toEqual(
            fees.minerFees.server + fees.minerFees.user.claim + 5,
        );
    });

    test("should apply minimalBatched limit for liquid submarine swaps", async () => {
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
        setPairAssets(LBTC, LN);
        signals.setSendAmount(BigNumber(41));
        await waitFor(() => {
            expect(signals.minimum()).toEqual(41);
        });
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
            setPairAssets(BTC, LN);
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
