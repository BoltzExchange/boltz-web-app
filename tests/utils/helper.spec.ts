import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hex } from "@scure/base";
import type { Pairs } from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";

import type * as ConfigModule from "../../src/config";
import { BTC } from "../../src/consts/Assets";
import { ECPair } from "../../src/utils/ecpair";
import {
    formatAddress,
    formatSwapId,
    getDestinationAddress,
    getPair,
    getReferral,
    getRegularReferral,
    parsePrivateKey,
} from "../../src/utils/helper";
import type {
    ChainSwap,
    ReverseSwap,
    SubmarineSwap,
} from "../../src/utils/swapCreator";

vi.mock("../../src/utils/ecpair", () => {
    return {
        ECPair: {
            fromWIF: vi.fn().mockReturnValue({ key: "data" }),
            fromPrivateKey: vi.fn().mockReturnValue({ key: "data" }),
        },
    };
});

const { configMock } = vi.hoisted(() => ({
    configMock: { isPro: false } as { isPro: boolean },
}));

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: new Proxy(actual.config as object, {
            get(target, prop) {
                if (prop === "isPro") {
                    return configMock.isPro;
                }
                return target[prop as keyof typeof target];
            },
        }),
    };
});

describe("helper", () => {
    test.each`
        swap                                                             | expected
        ${{ id: "backend-swap1", type: SwapType.Submarine }}             | ${"backend-swap1"}
        ${{ id: "12345678", type: SwapType.Commitment }}                 | ${"12345678"}
        ${{ id: "commitment-12345678-1234", type: SwapType.Commitment }} | ${"12345678"}
    `("formats swap ids", ({ swap, expected }) => {
        expect(formatSwapId(swap)).toEqual(expected);
    });

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

            expect(parsePrivateKey(mockDerive, BTC, keyIndex)).toBe(key);
            expect(mockDerive).toHaveBeenCalledTimes(1);
            expect(mockDerive).toHaveBeenCalledWith(keyIndex, BTC);
        });

        test("should parse hex private key", () => {
            const privateKeyHex = hex.encode(secp256k1.utils.randomSecretKey());
            const mockResult = { key: "data" };
            vi.mocked(ECPair.fromPrivateKey).mockReturnValueOnce(
                mockResult as never,
            );

            const mockDerive = vi.fn();

            expect(
                parsePrivateKey(mockDerive, BTC, undefined, privateKeyHex),
            ).toEqual(mockResult);

            // Verify derive function wasn't called
            expect(mockDerive).not.toHaveBeenCalled();
            expect(ECPair.fromPrivateKey).toHaveBeenCalledTimes(1);
        });
    });

    describe("formatAddress", () => {
        test.each`
            groupSize    | expected
            ${undefined} | ${["bcrt1", "qrhg8", "z3ccu", "8vmnz", "7xvwx", "8t92m", "ykw6r", "u64k9", "6e4v"]}
            ${5}         | ${["bcrt1", "qrhg8", "z3ccu", "8vmnz", "7xvwx", "8t92m", "ykw6r", "u64k9", "6e4v"]}
            ${4}         | ${["bcrt", "1qrh", "g8z3", "ccu8", "vmnz", "7xvw", "x8t9", "2myk", "w6ru", "64k9", "6e4v"]}
        `(
            "should format address in groups of $groupSize characters",
            ({ groupSize, expected }) => {
                const address = "bcrt1qrhg8z3ccu8vmnz7xvwx8t92mykw6ru64k96e4v";
                expect(formatAddress(address, groupSize)).toEqual(expected);
            },
        );

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

        test("returns the connected signer for an EVM reverse swap", () => {
            const swap = {
                type: SwapType.Reverse,
                assetReceive: "RBTC",
                signer: "0x000000000000000000000000000000000000beef",
                claimAddress: "0x000000000000000000000000000000000000dEad",
            } as unknown as ReverseSwap;

            expect(getDestinationAddress(swap)).toBe(
                "0x000000000000000000000000000000000000beef",
            );
        });

        test("falls back to claimAddress for an EVM reverse swap without signer", () => {
            const swap = {
                type: SwapType.Reverse,
                assetReceive: "RBTC",
                claimAddress: "0x000000000000000000000000000000000000dEad",
            } as unknown as ReverseSwap;

            expect(getDestinationAddress(swap)).toBe(
                "0x000000000000000000000000000000000000dEad",
            );
        });

        test("returns empty string for null/undefined swap", () => {
            expect(getDestinationAddress(null)).toBe("");
            expect(getDestinationAddress(undefined)).toBe("");
        });
    });

    describe("referral helpers", () => {
        const originalUserAgent = navigator.userAgent;

        const setUserAgent = (ua: string) => {
            Object.defineProperty(navigator, "userAgent", {
                configurable: true,
                value: ua,
            });
        };

        afterEach(() => {
            configMock.isPro = false;
            setUserAgent(originalUserAgent);
        });

        test("getRegularReferral returns desktop referral on desktop", () => {
            setUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
            expect(getRegularReferral()).toBe("boltz_webapp_desktop");
        });

        test("getRegularReferral returns mobile referral on mobile", () => {
            setUserAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36");
            expect(getRegularReferral()).toBe("boltz_webapp_mobile");
        });

        test("getRegularReferral ignores config.isPro", () => {
            configMock.isPro = true;
            setUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
            expect(getRegularReferral()).toBe("boltz_webapp_desktop");
        });

        test("getReferral returns 'pro' when config.isPro is true", () => {
            configMock.isPro = true;
            expect(getReferral()).toBe("pro");
        });

        test("getReferral returns regular referral when config.isPro is false", () => {
            configMock.isPro = false;
            setUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
            expect(getReferral()).toBe("boltz_webapp_desktop");
        });
    });
});
