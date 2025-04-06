import type { Pairs } from "../../src/utils/boltzClient";
import { ECPair } from "../../src/utils/ecpair";
import { getPair, parsePrivateKey } from "../../src/utils/helper";

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
});
