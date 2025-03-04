import { Pairs } from "../../src/utils/boltzClient";
import { ECPair } from "../../src/utils/ecpair";
import { getPair, parsePrivateKey } from "../../src/utils/helper";

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
            const key = ECPair.makeRandom();
            const mockDerive = jest.fn().mockReturnValue(key);

            expect(parsePrivateKey(mockDerive, keyIndex)).toBe(key);
            expect(mockDerive).toHaveBeenCalledTimes(1);
            expect(mockDerive).toHaveBeenCalledWith(keyIndex);
        });

        test("should parse hex private key", () => {
            const originalKey = ECPair.makeRandom();
            const privateKeyHex = originalKey.privateKey?.toString("hex");

            const mockDerive = jest.fn();

            expect(
                parsePrivateKey(mockDerive, undefined, privateKeyHex),
            ).toEqual(originalKey);

            // Verify derive function wasn't called
            expect(mockDerive).not.toHaveBeenCalled();
        });

        test("should parse WIF private key", () => {
            const originalKey = ECPair.makeRandom();
            const wif = originalKey.toWIF();

            const mockDerive = jest.fn();

            expect(parsePrivateKey(mockDerive, undefined, wif)).toEqual(
                originalKey,
            );

            // Verify derive function wasn't called
            expect(mockDerive).not.toHaveBeenCalled();
        });
    });
});
