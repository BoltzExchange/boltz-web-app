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
            privateKey: "a3cd1a24ef10189dd2ee7ec7a6b90d9f2e2da65bca68b675365e09d45b7c6530",
            address: "2N4e6SQjs1mfiCFkP2XNVZ81kg1EMD56ahr",
            redeemScript: "a914df70c5de77acd4dac7e14d19a3d75fb749e7862d87632103f82bf603cda9cc3fa2558638213664f50cf77adb250a94420807fb56b888ce746702f901b1752102542081e340c94275636172d93c78ace3a58c1f639ebbe03cccc5922a70957e5768ac",
        };
        const swap_invalid_amount = {
            reverse: false,
            sendAmount: 10636,
            expectedAmount: 10000,
            privateKey: "a3cd1a24ef10189dd2ee7ec7a6b90d9f2e2da65bca68b675365e09d45b7c6530",
            address: "2N4e6SQjs1mfiCFkP2XNVZ81kg1EMD56ahr",
            redeemScript: "a914df70c5de77acd4dac7e14d19a3d75fb749e7862d87632103f82bf603cda9cc3fa2558638213664f50cf77adb250a94420807fb56b888ce746702f901b1752102542081e340c94275636172d93c78ace3a58c1f639ebbe03cccc5922a70957e5768ac",
        };
        const swap_invalid_address = {
            reverse: false,
            sendAmount: 10636,
            expectedAmount: 10000,
            privateKey: "a3cd1a24ef10189dd2ee7ec7a6b90d9f2e2da65bca68b675365e09d45b7c6530",
            address: "2N4e6SQjs1mfiCFkP2XNVZ81kg1EMD56xxx",
            redeemScript: "a914df70c5de77acd4dac7e14d19a3d75fb749e7862d87632103f82bf603cda9cc3fa2558638213664f50cf77adb250a94420807fb56b888ce746702f901b1752102542081e340c94275636172d93c78ace3a58c1f639ebbe03cccc5922a70957e5768ac",
        };
        const swap_invalid_preimage_hash = {
            reverse: false,
            sendAmount: 10636,
            expectedAmount: 10000,
            privateKey: "a3cd1a24ef10189dd2ee7ec7a6b90d9f2e2da65bca68b675365e09d45b7c6530",
            address: "2N4e6SQjs1mfiCFkP2XNVZ81kg1EMD56ahr",
            redeemScript: "a914df70c5de77acd4dac7e14d19a3d75fb749e7862d87632103f82bf603cda9cc3fa2558638213664f50cf77adb250a94420807fb56b888ce746702f901b1752102542081e340c94275636172d93c78ace3a58c1f639ebbe03cccc5922a70957e5768ac",
        };
        test.each`
            desc                       | valid    | swap
            ${"valid"}                 | ${true}  | ${swap_valid}
            ${"invalid amount"}        | ${false} | ${swap_invalid_amount}
            ${"invalid address"}       | ${false} | ${swap_invalid_address}
            ${"invalid preimage hash"} | ${false} | ${swap_invalid_preimage_hash}
        `("$desc", ({ valid, swap }) => {
            expect(validateResponse(swap)).toBe(valid);
        });
    });
});
