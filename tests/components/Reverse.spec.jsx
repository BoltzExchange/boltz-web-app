import { describe, test, expect } from "vitest";
import { fireEvent, render } from "@solidjs/testing-library";
import { BTC, LN } from "../../src/config";
import Reverse from "../../src/components/Reverse";
import {
    reverse,
    assetSend,
    assetReceive,
    setAssetSend,
    setAssetReceive,
} from "../../src/signals";

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
