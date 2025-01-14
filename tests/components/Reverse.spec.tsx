import { fireEvent, render } from "@solidjs/testing-library";

import Reverse from "../../src/components/Reverse";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { TestComponent, contextWrapper, signals } from "../helper";

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

        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        fireEvent.click(flip);

        expect(signals.assetSend()).toEqual(LN);
        expect(signals.assetReceive()).toEqual(BTC);
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
        signals.setAssetSend(LBTC);
        signals.setAssetReceive(BTC);

        fireEvent.click(flip);

        expect(signals.onchainAddress()).toEqual("");
    });
});
