import { decodeInvoice, validateResponse } from "../../src/utils/validation";

describe("validate responses", () => {
    describe("decode invoices", () => {
        test.each`
            network      | invoice
            ${"regtest"} | ${"lnbcrt623210n1pj8hfdspp5mhcxq3qgzn779zs0c02na32henclzt55uga68kck6tknyw0y59qsdqqcqzzsxqyz5vqsp54wll9s5jphgcjqzpnamqeszvfdz937pjels2cqr84pltjsqv2asq9qyyssq49028nqec7uz5vk73peg5a4fkxhltw90kkmupfradjp0sus6g5zxs6njedk8ml3qgdls3dfjfvd7z3py5qgst9fnzz5pwcr5564sf6sqtrlfzz"}
            ${"testnet"} | ${"lntb4573450n1pj8hfnmsp58erxc4m9u09frqkalhw5udgvghvm27wewl99d7z3hjftgwtt234qpp572p5y0tplt70txw35kzypsef4mg2pwp5u0ej9hx8tse6f2rcvrjsdq5g9kxy7fqd9h8vmmfvdjsxqyjw5qcqp2rzjq0cxp9fmaadhwlw80ez2lgu9n5pzlsd803238r0tyv4dwf27s6wqqfggesqqqfqqqyqqqqlgqqqqqqgq9q9qyysgqw4msvmfgakcmxkglwnj7qgp6hlupefstyzhkld0uxlx3gdncnzw385c5qy6ng2qh59rtttktjzy8l43gzv3n9u6du64z2xu0mdz377splwf2qy"}
            ${"mainnet"} | ${"lnbc678450n1pj8hf4kpp5kxh4x93kvxt43q0k0q6t3fp6gfhgusqxsajj6lcexsrg4lzm7rrqdq5g9kxy7fqd9h8vmmfvdjscqzzsxqyz5vqsp5n4rzwr2lzw68082ws4tjjerp2t5eluny75xx54jr530x073tvvzs9qyyssq3f43e2mzqx07zzt529ux480nj00908p3u5qdwhyuk3qrcepaqsjxqjhcnfde4ta74c3dkxkhwscxfhdm5v0y7qh7np22v9xc220taacqjanm3m"}
        `("should decode $network invoices", ({ invoice }) => {
            expect(decodeInvoice(invoice)).toMatchSnapshot();
        });
    });

    describe("validate reverse swap", () => {
        const reverseSwapBtc = {
            asset: "BTC",
            reverse: true,
            sendAmount: 100000,
            receiveAmount: 99294,
            onchainAmount: 99294,
            timeoutBlockHeight: 255,
            privateKey:
                "3745eebb3780cdc34f9790eee6315349e73047c75b3d27c73819ff5aa4c85c59",
            preimage:
                "7b940357996614596f1b5c6a6067b085222077fb8f605cfe7cd26e984db1fd92",
            redeemScript:
                "8201208763a91400884cd36bf1e5a1bfbe50b54e41bb0ab2dfebdd882103b9b0ea9a8ea9f7cd5c757c4753aa30d75ee149a1f97b87bc5d1a4174b35fe769677502ff00b1752102ab507fc9eb1a649b8b08124a6eba7dcfe4b274182c8e5f1bdf1aaf26bbccc43a68ac",
            lockupAddress:
                "bcrt1qnlgndne3nkegw26farddenukdyuact7cuxu05cuy8yevk2cgxsfqcxx4q4",
            invoice:
                "lnbcrt1m1pj8hjq8pp5ylcun2dmcl0jukwprey0sxpnm6kfurwngvqrglak8www5rm9thqqdql2djkuepqw3hjqsj5gvsxzerywfjhxuccqzynxqrrsssp540730ua8hdkcgj2ku5j4vteqaclqwvl7k0seftqwksqvyuu8z23s9qyyssqwul9n7e3nwa2kzp287c8jwsgvqekkate8zgme7qpqvajm2nldlvshfzmcjtynl3lpst8yexqgyzjcprmftg0sxxvgfal69xyhy8qe7gplmdglh",
        };

        test.each`
            desc                                            | valid    | swap
            ${"BTC valid"}                                  | ${true}  | ${reverseSwapBtc}
            ${"BTC invalid receive amount"}                 | ${false} | ${{ ...reverseSwapBtc, onchainAmount: reverseSwapBtc.onchainAmount - 1 }}
            ${"BTC invalid invoice amount"}                 | ${false} | ${{ ...reverseSwapBtc, invoice: "lnbcrt1000010n1pj8hjy9pp5ylcun2dmcl0jukwprey0sxpnm6kfurwngvqrglak8www5rm9thqqdqqcqzzsxqyz5vqsp5xas59ytzy77vr7nz3q20ekfp36pahnf7pyp5yu2q6j69s0gf2mzq9qyyssq98vhx0hwngawut2n240ye2j693qh4afptj3fx93kdxdgelhg8w4ntqj6za2txudm2t8ge649h5jcleqrrhk2ef4hymjtmly4mma07lgpru8e9j" }}
            ${"BTC invalid invoice preimage hash"}          | ${false} | ${{ ...reverseSwapBtc, invoice: "lnbcrt1m1pj8hjyjpp53ge8f7m79de2q3e4j8amvq9jq3g0eag9vymzyd32gjw3cz3uhjfqdqqcqzzsxqyz5vqsp52vdnu0n3yh8m0sykqk4gl6h9v7l4r736z4qswm8tmahvjet6w7uq9qyyssqytl6pnuel293xmkgnu9hc5f4taekhgl023zceztzy0eugya6908p5y0txdx0p0q448uru6ecqhd78aarr0lkj95h4s7nwrymjvnkdwcq2ds4qy" }}
            ${"BTC invalid redeem script claim public key"} | ${false} | ${{ ...reverseSwapBtc, redeemScript: "8201208763a91400884cd36bf1e5a1bfbe50b54e41bb0ab2dfebdd882103b9b0ea9a8ea9f7cd5c757c4753aa30d75ee1f9a1f97b87bc5d1a4174b35fe769677502ff00b17521037c7980160182adad9eaea06c1b1cdf9dfdce5ef865c386a112bff4a62196caf668ac" }}
            ${"BTC invalid redeem script preimage hash"}    | ${false} | ${{ ...reverseSwapBtc, redeemScript: "8201208763a9143ab4a6bb65bbf58652aac526832ead9461aeb939882103b9b0ea9a8ea9f7cd5c757c4753aa30d75ee149a1f97b87bc5d1a4174b35fe769677502ff00b17521036e2b63f3aa1f1e6b50438af9c505c25d3faeeb72414e84100a9ced7b5cddace168ac" }}
            ${"BTC invalid lockupAddress"}                  | ${false} | ${{ ...reverseSwapBtc, lockupAddress: "bcrt1qcqyj0mdse8ewusdxgm30ynsnqw4j5700vsdgm8xg0eft5rqdnpgs9ndhwx" }}
        `("$desc", ({ valid, swap }) => {
            expect(validateResponse(swap)).toBe(valid);
        });
    });

    /*
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
    */
});
