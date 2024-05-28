import { getPair } from "../../src/utils/helper";

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
            } as any;

            expect(getPair(config, swapType, assetSend, assetReceive)).toEqual(
                expected,
            );
        },
    );
});
