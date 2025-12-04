import { SwapType } from "../../src/consts/Enums";
import type { Pairs } from "../../src/utils/boltzClient";
import { ECPair } from "../../src/utils/ecpair";
import {
    formatAddress,
    getDestinationAddress,
    getPair,
    parsePrivateKey,
} from "../../src/utils/helper";
import type { ChainSwap, SubmarineSwap } from "../../src/utils/swapCreator";

vi.mock("../../src/utils/ecpair", () => {
    return {
        ECPair: {
            fromWIF: vi.fn().mockReturnValue({ key: "data" }),
            fromPrivateKey: vi.fn().mockReturnValue({ key: "data" }),
        },
    };
});

describe("helper", () => {
    test.each`
        swapType       | assetSend     | assetReceive  | expected
        ${"submarine"} | ${"notFound"} | ${"notFound"} | ${undefined}
        ${"submarine"} | ${"BTC"}      | ${"BTC"}      | ${undefined}
        ${"submarine"} | ${"L-BTC"}    | ${"L-BTC"}    | ${undefined}
        ${"submarine"} | ${"L-BTC"}    | ${"BTC"}      | ${{ pair: 1 }}
        ${"reverse"}   | ${"BTC"}      | ${"BTC"}      | ${undefined}
        ${"reverse"}   | ${"L-BTC"}    | ${"BTC"}      | ${undefined}
        ${"reverse"}   | ${"BTC"}      | ${"L-BTC"}    | ${{ pair: 2 }}
        ${"chain"}     | ${"BTC"}      | ${"L-BTC"}    | ${{ pair: 3 }}
    `(
        "should get pair from config, expect: `$expected` from `$swapType: $assetSend > $assetReceive`",
        ({ swapType, assetSend, assetReceive, expected }) => {
            const config = {
                submarine: {
                    "L-BTC": {
                        BTC: {
                            pair: 1,
                        },
                    },
                },
                reverse: {
                    BTC: {
                        "L-BTC": {
                            pair: 2,
                        },
                    },
                },
                chain: {
                    BTC: {
                        "L-BTC": {
                            pair: 3,
                        },
                    },
                },
            } as unknown as Pairs;

            expect(getPair(config, swapType, assetSend, assetReceive)).toEqual(
                expected,
            );
        },
    );

    describe("parsePrivateKey", () => {
        test("should use derive function when keyIndex is provided", () => {
            const keyIndex = 42;
            const key = { key: "data" };
            const mockDerive = vi.fn().mockReturnValue(key);

            expect(parsePrivateKey(mockDerive, keyIndex)).toBe(key);
            expect(mockDerive).toHaveBeenCalledTimes(1);
            expect(mockDerive).toHaveBeenCalledWith(keyIndex);
        });

        test("should parse hex private key", () => {
            const originalKey = { key: "data" };
            const privateKeyHex = originalKey.key;

            const mockDerive = vi.fn();

            expect(
                parsePrivateKey(mockDerive, undefined, privateKeyHex),
            ).toEqual(originalKey);

            // Verify derive function wasn't called
            expect(mockDerive).not.toHaveBeenCalled();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(ECPair.fromPrivateKey).toHaveBeenCalledTimes(1);
        });
    });

    describe("formatAddress", () => {
        test("should format Bitcoin address in groups of 5 characters", () => {
            const address = "bcrt1qrhg8z3ccu8vmnz7xvwx8t92mykw6ru64k96e4v";
            const expected = [
                "bcrt1",
                "qrhg8",
                "z3ccu",
                "8vmnz",
                "7xvwx",
                "8t92m",
                "ykw6r",
                "u64k9",
                "6e4v",
            ];
            expect(formatAddress(address)).toEqual(expected);
        });

        test("should handle empty string", () => {
            expect(formatAddress("")).toEqual([]);
        });

        test("should format short addresses", () => {
            expect(formatAddress("abc")).toEqual(["abc"]);
            expect(formatAddress("abcde")).toEqual(["abcde"]);
            expect(formatAddress("abcdef")).toEqual(["abcde", "f"]);
        });

        test("should handle null or undefined gracefully", () => {
            expect(formatAddress(null)).toEqual([]);
            expect(formatAddress(undefined)).toEqual([]);
        });
    });

    describe("getDestinationAddress", () => {
        test("should return originalDestination for submarine swap (Lightning address/LNURL)", () => {
            const swap = {
                type: SwapType.Submarine,
                assetReceive: "BTC",
                invoice: "lnbc1234567890abcdefghijklmnopqrstuvwxyz1234567890",
                originalDestination: "user@getalby.com",
            } as SubmarineSwap;

            expect(getDestinationAddress(swap)).toBe("user@getalby.com");
        });

        test("should fallback to invoice for submarine swap without originalDestination", () => {
            const swap = {
                type: SwapType.Submarine,
                assetReceive: "BTC",
                invoice: "lnbc1234567890abcdefghijklmnopqrstuvwxyz1234567890",
            } as SubmarineSwap;

            expect(getDestinationAddress(swap)).toBe(
                "lnbc1234567890abcdefghijklmnopqrstuvwxyz1234567890",
            );
        });

        test("should return originalDestination for chain swap (MRH case)", () => {
            const swap = {
                type: SwapType.Chain,
                assetReceive: "L-BTC",
                claimAddress: "liquid1qabcdefghijklmnopqrstuvwxyz",
                originalDestination: "user@getalby.com",
            } as ChainSwap;

            expect(getDestinationAddress(swap)).toBe("user@getalby.com");
        });

        test("should fallback to claimAddress for chain swap without originalDestination", () => {
            const swap = {
                type: SwapType.Chain,
                assetReceive: "L-BTC",
                claimAddress: "liquid1qabcdefghijklmnopqrstuvwxyz",
            } as ChainSwap;

            expect(getDestinationAddress(swap)).toBe(
                "liquid1qabcdefghijklmnopqrstuvwxyz",
            );
        });
    });
});
