import { validateResponse } from "../../src/utils/validation";

describe("validate response", () => {
    describe("validate reverse swap", () => {
        const reverse_swap_valid = {
            reverse: true,
            sendAmount: 10636,
            invoice:
                "lnbcrt106360n1pj80rvppp5wxsjnslfqa48kqgc4j29lvnu6n5h2weh4mvq5vw3x42vgltdnnxqdql2djkuepqw3hjqsj5gvsxzerywfjhxuccqzynxqrrsssp5ulqefm7n776mx6qmpysaxqfhkzlznkdu77sj0g4ck48zy4n9d3vs9qyyssq4s5k9fyet4er4cr2dsxcjxngpyy349htkanwkhd4n6njq58thgs8mw6sq9tyyf5a0rqtd0ggpqcsgejn9525x8juna3dg36kgymr49gqa3pchk",
            preimage:
                "0163bc336abf8c5ac4696d27d14090e80806aeb160aa159f5b251d056c43a928",
        };
        const reverse_swap_invalid_preimage_hash = {
            reverse: true,
            sendAmount: 10636,
            invoice:
                "lnbcrt106360n1pj80rvppp5wxsjnslfqa48kqgc4j29lvnu6n5h2weh4mvq5vw3x42vgltdnnxqdql2djkuepqw3hjqsj5gvsxzerywfjhxuccqzynxqrrsssp5ulqefm7n776mx6qmpysaxqfhkzlznkdu77sj0g4ck48zy4n9d3vs9qyyssq4s5k9fyet4er4cr2dsxcjxngpyy349htkanwkhd4n6njq58thgs8mw6sq9tyyf5a0rqtd0ggpqcsgejn9525x8juna3dg36kgymr49gqa3pchk",
            preimage:
                "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        };
        const reverse_swap_invalid_amount = {
            reverse: true,
            sendAmount: 10000,
            invoice:
                "lnbcrt106360n1pj80rvppp5wxsjnslfqa48kqgc4j29lvnu6n5h2weh4mvq5vw3x42vgltdnnxqdql2djkuepqw3hjqsj5gvsxzerywfjhxuccqzynxqrrsssp5ulqefm7n776mx6qmpysaxqfhkzlznkdu77sj0g4ck48zy4n9d3vs9qyyssq4s5k9fyet4er4cr2dsxcjxngpyy349htkanwkhd4n6njq58thgs8mw6sq9tyyf5a0rqtd0ggpqcsgejn9525x8juna3dg36kgymr49gqa3pchk",
            preimage:
                "0163bc336abf8c5ac4696d27d14090e80806aeb160aa159f5b251d056c43a928",
        };
        test.each`
            desc                  | valid    | swap
            ${"valid"}            | ${true}  | ${reverse_swap_valid}
            ${"invalid preimage"} | ${false} | ${reverse_swap_invalid_preimage_hash}
            ${"invalid amount"}   | ${false} | ${reverse_swap_invalid_amount}
        `("$desc", ({ valid, swap }) => {
            expect(validateResponse(swap)).toBe(valid);
        });
    });
    describe("validate normal swap", () => {
        const swap_valid = {
            reverse: false,
            sendAmount: 10636,
            expectedAmount: 10636,
        };
        const swap_invalid_amount = {
            reverse: false,
            sendAmount: 10636,
            expectedAmount: 10000,
        };
        test.each`
            desc                | valid    | swap
            ${"valid"}          | ${true}  | ${swap_valid}
            ${"invalid amount"} | ${false} | ${swap_invalid_amount}
        `("$desc", ({ valid, swap }) => {
            expect(validateResponse(swap)).toBe(valid);
        });
    });
});
