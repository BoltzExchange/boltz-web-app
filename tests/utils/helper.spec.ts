import { getPair } from "../../src/utils/helper";

describe("helper", () => {
    test.each`
        asset         | isReverse | expected
        ${"notFound"} | ${false}  | ${undefined}
        ${"BTC"}      | ${false}  | ${undefined}
        ${"L-BTC"}    | ${false}  | ${{ pair: 1 }}
        ${"BTC"}      | ${true}   | ${undefined}
        ${"L-BTC"}    | ${true}   | ${{ pair: 2 }}
    `("should get pair from config", ({ asset, isReverse, expected }) => {
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
        } as any;

        expect(getPair(config, asset, isReverse)).toEqual(expected);
    });
});
