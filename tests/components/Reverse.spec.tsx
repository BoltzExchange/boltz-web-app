import { fireEvent, render } from "@solidjs/testing-library";

import Reverse from "../../src/components/Reverse";
import { BTC, LN } from "../../src/consts/Assets";
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
});
