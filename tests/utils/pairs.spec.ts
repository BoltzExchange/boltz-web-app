import { BTC, LBTC, LN, RBTC } from "../../src/consts/Assets";
import { isPairValid } from "../../src/utils/pairs";
import { pairs } from "../pairs";

describe("pairs", () => {
    test.each`
        send    | receive | isValid
        ${BTC}  | ${LN}   | ${true}
        ${LN}   | ${BTC}  | ${true}
        ${LBTC} | ${BTC}  | ${true}
        ${"NO"} | ${BTC}  | ${false}
        ${RBTC} | ${LBTC} | ${false}
    `(
        "should check if pair $send/$receive is valid",
        ({ send, receive, isValid }) => {
            expect(isPairValid(pairs, send, receive)).toEqual(isValid);
        },
    );

    test("should not throw when pairs is undefined", () => {
        expect(isPairValid(undefined, BTC, LN)).toEqual(false);
    });
});
