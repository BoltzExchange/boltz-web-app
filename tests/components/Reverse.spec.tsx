import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, test } from "vitest";

import Reverse from "../../src/components/Reverse";
import { BTC, LN } from "../../src/consts";
import {
    assetReceive,
    assetSend,
    reverse,
    setAssetReceive,
    setAssetSend,
} from "../../src/signals";

describe("Reverse", () => {
    test("should reverse assets", async () => {
        setAssetSend(BTC);
        setAssetReceive(LN);

        expect(reverse()).toEqual(false);

        const {
            container: { firstChild: flip },
        } = render(() => <Reverse />);
        fireEvent.click(flip);

        expect(reverse()).toEqual(true);
        expect(assetSend()).toEqual(LN);
        expect(assetReceive()).toEqual(BTC);
    });
});
