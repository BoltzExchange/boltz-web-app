import { fireEvent, render } from "@solidjs/testing-library";

import Reverse from "../../src/components/Reverse";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import Pair from "../../src/utils/Pair";
import { TestComponent, contextWrapper, signals } from "../helper";

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

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

        setPairAssets(BTC, LN);

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
        setPairAssets(LBTC, BTC);

        fireEvent.click(flip);

        expect(signals.onchainAddress()).toEqual("");
    });
});
