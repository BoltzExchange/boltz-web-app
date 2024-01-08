import { render } from "@solidjs/testing-library";
import { describe, expect, test } from "vitest";

import { BTC, LBTC, LN } from "../../src/consts";
import { CreateProvider, useCreateContext } from "../../src/context/Create";

describe("signals", () => {
    let signals: any;

    const TestComponent = () => {
        signals = useCreateContext();
        return "";
    };

    test.each`
        value               | expected
        ${LN}               | ${false}
        ${BTC}              | ${true}
        ${LBTC}             | ${true}
        ${"something else"} | ${true}
    `(
        "should set reverse to $expected based on assetReceive $value",
        ({ value, expected }) => {
            render(() => (
                <CreateProvider>
                    <TestComponent />
                </CreateProvider>
            ));
            signals.setReverse(undefined);
            signals.setAssetReceive(value);
            expect(signals.reverse()).toEqual(expected);
        },
    );

    test.each`
        func         | value      | expectedAsset
        ${"send"}    | ${LN}      | ${undefined}
        ${"send"}    | ${BTC}     | ${BTC}
        ${"send"}    | ${LBTC}    | ${LBTC}
        ${"send"}    | ${"smthg"} | ${"smthg"}
        ${"receive"} | ${LN}      | ${undefined}
        ${"receive"} | ${BTC}     | ${BTC}
        ${"receive"} | ${LBTC}    | ${LBTC}
        ${"receive"} | ${"smthg"} | ${"smthg"}
    `(
        "should set asset based on assetSend and assetReceive selection",
        ({ func, value, expectedAsset }) => {
            render(() => (
                <CreateProvider>
                    <TestComponent />
                </CreateProvider>
            ));
            signals.setAsset(undefined);
            if (func === "send") {
                signals.setAssetSend(value);
            }
            if (func === "receive") {
                signals.setAssetReceive(value);
            }
            expect(signals.asset()).toEqual(expectedAsset);
        },
    );
});
