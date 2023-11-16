import { BTC, LBTC, LN } from "../src/consts.js";
import {
    asset,
    reverse,
    setAsset,
    setReverse,
    setAssetSend,
    setAssetReceive,
} from "../src/signals.js";
import { expect } from "vitest";

describe("signals", () => {
    test.each`
        value               | expected
        ${LN}               | ${false}
        ${BTC}              | ${true}
        ${LBTC}             | ${true}
        ${"something else"} | ${true}
    `(
        "should set reverse to $expected based on assetReceive $value",
        ({ value, expected }) => {
            setReverse(undefined);
            setAssetReceive(value);
            expect(reverse()).toEqual(expected);
        },
    );

    test.each`
        func               | value      | expectedAsset
        ${setAssetSend}    | ${LN}      | ${undefined}
        ${setAssetSend}    | ${BTC}     | ${BTC}
        ${setAssetSend}    | ${LBTC}    | ${LBTC}
        ${setAssetSend}    | ${"smthg"} | ${"smthg"}
        ${setAssetReceive} | ${LN}      | ${undefined}
        ${setAssetReceive} | ${BTC}     | ${BTC}
        ${setAssetReceive} | ${LBTC}    | ${LBTC}
        ${setAssetReceive} | ${"smthg"} | ${"smthg"}
    `(
        "should set asset based on assetSend and assetReceive selection",
        ({ func, value, expectedAsset }) => {
            setAsset(undefined);
            func(value);

            expect(asset()).toEqual(expectedAsset);
        },
    );
});
