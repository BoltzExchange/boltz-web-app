import { fireEvent, render } from "@solidjs/testing-library";

import Reverse from "../../src/components/Reverse";
import { BTC, LN } from "../../src/consts";
import { CreateProvider, useCreateContext } from "../../src/context/Create";

describe("Reverse", () => {
    let signals: any;

    const TestComponent = () => {
        signals = useCreateContext();
        return "";
    };

    test("should reverse assets", async () => {
        const {
            container: { firstChild: flip },
        } = render(() => (
            <CreateProvider>
                <Reverse />
                <TestComponent />
            </CreateProvider>
        ));

        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        expect(signals.reverse()).toEqual(false);

        fireEvent.click(flip);

        expect(signals.reverse()).toEqual(true);
        expect(signals.assetSend()).toEqual(LN);
        expect(signals.assetReceive()).toEqual(BTC);
    });
});
