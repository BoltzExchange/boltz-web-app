import { btcToSat, convertAmount, satToBtc } from "../src/public/denomination";
import { Denomination } from "../src/public/enums";

describe("btcToSat", () => {
    test("converts 1 BTC to 100_000_000 sat", () => {
        expect(btcToSat(1)).toBe(100_000_000);
    });

    test("converts 0.5 BTC", () => {
        expect(btcToSat(0.5)).toBe(50_000_000);
    });

    test("converts 0.00000001 BTC (1 sat)", () => {
        expect(btcToSat(0.00000001)).toBe(1);
    });

    test("converts 0 BTC to 0 sat", () => {
        expect(btcToSat(0)).toBe(0);
    });

    test("converts 21_000_000 BTC", () => {
        expect(btcToSat(21_000_000)).toBe(2_100_000_000_000_000);
    });
});

describe("satToBtc", () => {
    test("converts 100_000_000 sat to 1 BTC", () => {
        expect(satToBtc(100_000_000)).toBe(1);
    });

    test("converts 1 sat to 0.00000001 BTC", () => {
        expect(satToBtc(1)).toBe(0.00000001);
    });

    test("converts 0 sat to 0 BTC", () => {
        expect(satToBtc(0)).toBe(0);
    });

    test("converts 50_000 sat", () => {
        expect(satToBtc(50_000)).toBe(0.0005);
    });
});

describe("round-trip accuracy", () => {
    test.each([1, 100, 50_000, 100_000_000, 2_100_000_000_000_000])(
        "btcToSat(satToBtc(%i)) === %i",
        (sats) => {
            expect(btcToSat(satToBtc(sats))).toBe(sats);
        },
    );

    test.each([0.00000001, 0.001, 0.5, 1, 21_000_000])(
        "satToBtc(btcToSat(%f)) === %f",
        (btc) => {
            expect(satToBtc(btcToSat(btc))).toBe(btc);
        },
    );
});

describe("convertAmount", () => {
    test("converts BTC denomination to sats", () => {
        expect(convertAmount(1, Denomination.Btc)).toBe(100_000_000);
    });

    test("passes through sat denomination unchanged", () => {
        expect(convertAmount(50_000, Denomination.Sat)).toBe(50_000);
    });

    test("unknown denomination is treated as sat (default)", () => {
        expect(convertAmount(12345, "unknown")).toBe(12345);
    });

    test("zero is always zero regardless of denomination", () => {
        expect(convertAmount(0, Denomination.Btc)).toBe(0);
        expect(convertAmount(0, Denomination.Sat)).toBe(0);
    });
});

