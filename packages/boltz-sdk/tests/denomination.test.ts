import { BigNumber } from "bignumber.js";

import {
    btcToSat,
    convertAmount,
    satToBtc,
} from "../src/public/denomination";
import { init } from "../src/public/config";
import { Denomination } from "../src/public/enums";

beforeAll(() => {
    init({ apiUrl: "http://localhost:9001", network: "regtest" });
});

describe("btcToSat", () => {
    test("converts 1 BTC to 100_000_000 sat", () => {
        expect(btcToSat(BigNumber(1)).toNumber()).toBe(100_000_000);
    });

    test("converts 0.5 BTC", () => {
        expect(btcToSat(BigNumber(0.5)).toNumber()).toBe(50_000_000);
    });

    test("converts 0.00000001 BTC (1 sat)", () => {
        expect(btcToSat(BigNumber(0.00000001)).toNumber()).toBe(1);
    });

    test("converts 0 BTC to 0 sat", () => {
        expect(btcToSat(BigNumber(0)).toNumber()).toBe(0);
    });

    test("converts 21_000_000 BTC", () => {
        expect(btcToSat(BigNumber(21_000_000)).toNumber()).toBe(
            2_100_000_000_000_000,
        );
    });
});

describe("satToBtc", () => {
    test("converts 100_000_000 sat to 1 BTC", () => {
        expect(satToBtc(BigNumber(100_000_000)).toNumber()).toBe(1);
    });

    test("converts 1 sat to 0.00000001 BTC", () => {
        expect(satToBtc(BigNumber(1)).toNumber()).toBe(0.00000001);
    });

    test("converts 0 sat to 0 BTC", () => {
        expect(satToBtc(BigNumber(0)).toNumber()).toBe(0);
    });

    test("converts 50_000 sat", () => {
        expect(satToBtc(BigNumber(50_000)).toNumber()).toBe(0.0005);
    });
});

describe("round-trip accuracy", () => {
    test.each([1, 100, 50_000, 100_000_000, 2_100_000_000_000_000])(
        "btcToSat(satToBtc(%i)) === %i",
        (sats) => {
            expect(
                btcToSat(satToBtc(BigNumber(sats))).toNumber(),
            ).toBe(sats);
        },
    );

    test.each([0.00000001, 0.001, 0.5, 1, 21_000_000])(
        "satToBtc(btcToSat(%f)) === %f",
        (btc) => {
            expect(
                satToBtc(btcToSat(BigNumber(btc))).toNumber(),
            ).toBe(btc);
        },
    );
});

describe("convertAmount", () => {
    test("converts BTC denomination to sats", () => {
        expect(
            convertAmount("BTC", BigNumber(1), Denomination.Btc).toNumber(),
        ).toBe(100_000_000);
    });

    test("passes through sat denomination unchanged", () => {
        expect(
            convertAmount("BTC", BigNumber(50_000), Denomination.Sat).toNumber(),
        ).toBe(50_000);
    });

    test("unknown denomination is treated as sat (default)", () => {
        expect(
            convertAmount("BTC", BigNumber(12345), "unknown").toNumber(),
        ).toBe(12345);
    });

    test("zero is always zero regardless of denomination", () => {
        expect(
            convertAmount("BTC", BigNumber(0), Denomination.Btc).toNumber(),
        ).toBe(0);
        expect(
            convertAmount("BTC", BigNumber(0), Denomination.Sat).toNumber(),
        ).toBe(0);
    });
});
