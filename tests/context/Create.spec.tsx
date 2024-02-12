import { render } from "@solidjs/testing-library";

import { BTC, LBTC, LN } from "../../src/consts";
import { useCreateContext } from "../../src/context/Create";
import { contextWrapper } from "../helper";

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
            render(() => <TestComponent />, { wrapper: contextWrapper });
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
            render(() => <TestComponent />, { wrapper: contextWrapper });
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
