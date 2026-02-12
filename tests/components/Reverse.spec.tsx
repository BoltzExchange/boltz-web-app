import { fireEvent, render } from "@solidjs/testing-library";

import Reverse from "../../src/components/Reverse";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import Pair from "../../src/utils/pair";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";

describe("Reverse", () => {
    test("should reverse assets", () => {
        const {
            container: { firstChild: flip },
        } = render(
            () => (
                <>
                    <Reverse />
                    <TestComponent />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        signals.setPair(new Pair(globalSignals.pairs(), BTC, LN));

        fireEvent.click(flip);

        expect(signals.pair().fromAsset).toEqual(LN);
        expect(signals.pair().toAsset).toEqual(BTC);
    });

    test("should clear onChainAddress on reverse", () => {
        const {
            container: { firstChild: flip },
        } = render(
            () => (
                <>
                    <Reverse />
                    <TestComponent />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        signals.setOnchainAddress("2N17VNGbi4yUHtkD7vhrc8cpi9JGVmC8scn");
        signals.setPair(new Pair(globalSignals.pairs(), LBTC, BTC));

        fireEvent.click(flip);

        expect(signals.onchainAddress()).toEqual("");
    });
});
