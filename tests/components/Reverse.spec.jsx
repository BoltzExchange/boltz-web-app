import Reverse from "../../src/components/Reverse";
import { BTC, LN } from "../../src/config";
import {
    reverse,
    assetSend,
    assetReceive,
    setAssetSend,
    setAssetReceive,
} from "../../src/signals";
import { fireEvent, render } from "@solidjs/testing-library";
import { describe, test, expect } from "vitest";

describe("Reverse", () => {
    test("should reverse assets", async () => {
        setAssetSend(BTC);
        setAssetReceive(LN);

        expect(reverse()).toEqual(true);

        const {
            container: { firstChild: flip },
        } = render(() => <Reverse />);
        fireEvent.click(flip);

        expect(reverse()).toEqual(true);
        expect(assetSend()).toEqual(LN);
        expect(assetReceive()).toEqual(BTC);
    });
});
