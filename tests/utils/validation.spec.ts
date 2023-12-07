// import { deployedBytecode as EtherSwapBytecode } from "boltz-core/out/EtherSwap.sol/EtherSwap.json";
import { Contract } from "ethers";
import log from "loglevel";
import { beforeAll, describe, expect, test, vitest } from "vitest";

import { decodeAddress } from "../../src/compat";
import { BTC, LBTC } from "../../src/consts";
import t from "../../src/i18n";
import { validateInvoice, validateResponse } from "../../src/utils/validation";

describe("validate responses", () => {
    const getEtherSwap = (code: string): (() => Promise<Contract>) => {
        const getDeployedCode = vitest.fn().mockResolvedValue(code);
        return vitest.fn(() => ({
            getDeployedCode,
        })) as any;
    };

    beforeAll(() => {
        log.disableAll();
    });

    describe("normal swap", () => {
        const swapBtc = {
            asset: "BTC",
            sendAmount: 100540,
            expectedAmount: 100540,
            invoice:
                "lnbcrt1m1pj874zupp5yrgcraxjspv20k0xysp2xd8lavfj7d3dpxntn6zl5kl88sfmfymqdqqcqzzsxqyz5vqsp5we4hztl20lsht5fj6ggpanmqckjlsc8g25h8zng49kewsxqvr7gq9qyyssq5szker7v2drnqlg04e5v6xpau6zyhr6yj2ynthy2zc2qxd9ypgahavz3gks9m6snlldsv4y43r6srms4zkzp8ekqy39lj92lgjgyrzsqxw7zgt",
            privateKey:
                "8f618dbe65ee197e9681669b2d244904e316a7ee6b25ac7250ad91e99530dd04",
            bip21: "bitcoin:2NFjs5VkEHkX65QrZHwCgwXdphBvKPr6trL?amount=0.0010054&label=Send%20to%20BTC%20lightning",
            address: "2NFjs5VkEHkX65QrZHwCgwXdphBvKPr6trL",
            redeemScript:
                "a914d399489dee7893cee17d3c4fc29e2cd7317d0dac87632102ab507fc9eb1a649b8b08124a6eba7dcfe4b274182c8e5f1bdf1aaf26bbccc43a6702ff00b175210274b6bc0c00ad29ee072d46c5089d5c4fc9dcf92b55cc09295afc577ebb697c2b68ac",
            acceptZeroConf: false,
            timeoutBlockHeight: 255,
        };

        const swapBtcNativeSegwit = {
            asset: "BTC",
            sendAmount: 405220,
            expectedAmount: 405220,
            invoice:
                "lnbcrt4m1pj3s34lpp53z3yu4sj7zg7544h3rhg6lcdyk4chhgym7pd77zzwuumgqacqpdqdqqcqzzsxqyz5vqsp5e08q2vpvhs4ra9c6pj52zstd6gxkfesxfpc3f7kryn257nwu5djq9qyyssq03xrmk42pn6we6qdga4qhzcmglccv5y5u2743gxeu4j9w0jvvllke8wtddhqac22yh70vcl4d75tunyg4ncvjj46aewqvdwvejnl34cqucfzfl",
            privateKey:
                "69272ef503fae315265fb1a0852868e6971d355d58033efc457377307b2efc38",
            bip21: "bitcoin:bcrt1q8nm7wftpvllzakdvk5vmlcrvxqm7lj0vnjxj69vxjyxc9dstfe9q06lz5q?amount=0.0040522&label=Send%20to%20BTC%20lightning",
            address:
                "bcrt1q8nm7wftpvllzakdvk5vmlcrvxqm7lj0vnjxj69vxjyxc9dstfe9q06lz5q",
            redeemScript:
                "a914629103e7aa4dfdba0d0b2d8577fe5e40d3c69e2b876321024370b575d99a1511daf0f36c41ec3715fbbddee43f5290576fdb967f8a5190b167025c01b17521030f46aef763fbfaff4e6b8784628f3ab2cb5db02b1cc33b74e74683a99c7a7d5a68ac",
            acceptZeroConf: false,
            timeoutBlockHeight: 348,
        };

        const swapLbtc = {
            asset: "L-BTC",
            sendAmount: 100247,
            expectedAmount: 100247,
            invoice:
                "lnbcrt1m1pj87huhpp5hp6qcsxt6qtf00gzh5gppy4kneuyw6729vg75x2g3rygpfeq6j2sdqqcqzzsxqyz5vqsp5uejuuet7juhf2ukxm8zcujzj7skaksnpvzp0mlj5g0wvf4nmpnfs9qyyssqx5usafy2rnhx7mgw0ah4mxgal2n3fvm05xyjd2zamw9ey9zr8m55s8wt2uy66sfa8fgdfsa97uycdwxr498aejz3vh9zsxyk0dgahusqjp5rpc",
            privateKey:
                "bf69196ca2f0dd39ac297115189c88fb7f047fc42036b3132c319744def982da",
            bip21: "liquidnetwork:el1qqgjuf23nvuczc4v2z9d2xxp5thznve2l39slx7uvcuuwfprxy0f88pujh60f4tnc9y26rvf0nrhwe6jxdsfxr8ty3qnawpdfc2jykc3nmnq000sfdqls?amount=0.00100247&label=Send%20to%20BTC%20lightning&assetid=5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225",
            address:
                "el1qqgjuf23nvuczc4v2z9d2xxp5thznve2l39slx7uvcuuwfprxy0f88pujh60f4tnc9y26rvf0nrhwe6jxdsfxr8ty3qnawpdfc2jykc3nmnq000sfdqls",
            blindingKey:
                "69311d7bfc4e0e4889863d238cb469b05f946e3f22ca93b6fb533ad4ecd5354b",
            redeemScript:
                "a914a6919ecc7e9cc2e94f408cfe488b37fed2e7135a8763210368924b3f2c10a5ce7cb2ca67216fe9515759ed2a40a4fee37037e00f6bab24a46702dd05b175210376242bc11c31ecddd7556d155167b2dc3c09b1c3cfa18f07960ed58963901d7868ac",
            acceptZeroConf: false,
            timeoutBlockHeight: 1501,
        };

        test.each`
            desc                                   | valid    | contractCode | swap
            ${"BTC valid"}                         | ${true}  | ${""}        | ${swapBtc}
            ${"BTC native SegWit valid"}           | ${true}  | ${""}        | ${swapBtcNativeSegwit}
            ${"BTC invalid send amount"}           | ${false} | ${""}        | ${{ ...swapBtc, sendAmount: 12313123 }}
            ${"BTC invalid refund key"}            | ${false} | ${""}        | ${{ ...swapBtc, privateKey: "6321bb238f0678fb4c971024193f650eebe69fb891788e1af70184b2dd5d1d5f" }}
            ${"BTC invalid invoice preimage hash"} | ${false} | ${""}        | ${{ ...swapBtc, invoice: "lnbcrt1m1pj87krqpp508n5tj4ur4em04k9r0lg2nwm6jy0tvta6h3zrhvtypz8srhzapgqdqqcqzzsxqyz5vqsp5admanudc6jgftclpxh0wt8tzcd3qumhjhlnnhgmw57nagygrvjas9qyyssqfpaxy85h53v4cv4merj3fequfpfy3pry5tpazupv8v2wmcnh2vu463m44pgw3zlhyj3z6mkgnuat8eyrsr0p9zgq2w6fc0gacytgsmgpr8wa3v" }}
            ${"BTC invalid invalid address"}       | ${false} | ${""}        | ${{ ...swapBtc, address: "2NGVzk8fgA8zHRkLBwkAgZKnBn3aYG6wwSx" }}
            ${"BTC invalid BIP21 amount"}          | ${false} | ${""}        | ${{ ...swapBtc, bip21: "bitcoin:2NFjs5VkEHkX65QrZHwCgwXdphBvKPr6trL?amount=0.0010056&label=Send%20to%20BTC%20lightning" }}
            ${"BTC invalid BIP21 address"}         | ${false} | ${""}        | ${{ ...swapBtc, bip21: "bitcoin:2NGVzk8fgA8zHRkLBwkAgZKnBn3aYG6wwSx?amount=0.0010054&label=Send%20to%20BTC%20lightning" }}
            ${"L-BTC valid"}                       | ${true}  | ${""}        | ${swapLbtc}
            ${"L-BTC invalid blinding key"}        | ${false} | ${""}        | ${{ ...swapLbtc, blindingKey: "e5d35d6e263249d1defe206a41dc969df61b1b64347a655fb575421f0369b321" }}
        `(
            /*
            ${"RBTC valid"}                        | ${true}  | ${EtherSwapBytecode.object} | ${{ ...swapBtc, asset: RBTC }}
            ${"RBTC invalid send amount"}          | ${false} | ${""}                       | ${{ ...swapBtc, asset: RBTC, sendAmount: 12313123 }}
            ${"RBTC invalid contract code"}        | ${false} | ${"not correct"}            | ${{ ...swapBtc, asset: RBTC }}
        `*/
            "$desc",
            async ({ valid, contractCode, swap }) => {
                const contract = getEtherSwap(contractCode);
                await expect(
                    validateResponse(swap, contract, Buffer),
                ).resolves.toBe(valid);
            },
        );
    });

    describe("reverse swap", () => {
        const reverseSwapBtc = {
            asset: "BTC",
            reverse: true,
            sendAmount: 100000,
            onchainAmount: 99295,
            receiveAmount: 99294,
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

        const reverseSwapLbtc = {
            asset: "L-BTC",
            reverse: true,
            sendAmount: 100000,
            onchainAmount: 99475,
            receiveAmount: 99474,
            timeoutBlockHeight: 1541,
            privateKey:
                "a3731adcb36a8ea9f98f65de85311185d7138ceee307a0e5a40bb30753115a82",
            preimage:
                "f7554b1e89074eab7f186438e2d0e1ac03fa1e3e2e787106a10facf06ecd69de",
            invoice:
                "lnbcrt1m1pj8uh09pp54qq2qy68v7tvz2exmjdkzxdznh5gmsyu8ym30pt5cnnrj3r7srqsdpz2djkuepqw3hjqnpdgf2yxgrpv3j8yetnwvcqz95xqrrsssp56a85evmgnu4egwgfsfeprm8255pkea49zn44mg47edvsxz24ym6s9qyyssqjad5vyxsyhvfa7x0npsuyyrehkguwsrweg0vpfpyk2464n6ygnw9r56ujn6usqkvppl6kszpp62gykhsxmd5fmzuf0gp9y23am95cfsqg7x4jd",
            blindingKey:
                "8791b078cb128e537424a6eca3a5335ce860b2e825c7abbc5fbc1ce808f960e7",
            redeemScript:
                "8201208763a914e28fade4aabbbf031ca7f2bd6ea3a6cd702cd28688210341c185ef27e8187a069f2f31091a4454e4a822e64fd1a554ebb3e9e9a70e98f26775020506b175210310e5c8b330e774edce688a4091948c0a2c4395ca452e432821ce0dc961655a5368ac",
            lockupAddress:
                "el1qqdmeywy40z2aasvaydsnmgqqqcgk92cvd9p9h4mpeh2x83dy79mhltd4al45ylxu33qsyu5l4z0srhagm5krl2n2cgxra5n88chxle7ctnpml5s983jr",
        };

        test.each`
            desc                                            | valid    | contractCode | swap
            ${"BTC valid"}                                  | ${true}  | ${""}        | ${reverseSwapBtc}
            ${"BTC invalid receive amount"}                 | ${false} | ${""}        | ${{ ...reverseSwapBtc, onchainAmount: reverseSwapBtc.onchainAmount - 1 }}
            ${"BTC invalid invoice amount"}                 | ${false} | ${""}        | ${{ ...reverseSwapBtc, invoice: "lnbcrt1000010n1pj8hjy9pp5ylcun2dmcl0jukwprey0sxpnm6kfurwngvqrglak8www5rm9thqqdqqcqzzsxqyz5vqsp5xas59ytzy77vr7nz3q20ekfp36pahnf7pyp5yu2q6j69s0gf2mzq9qyyssq98vhx0hwngawut2n240ye2j693qh4afptj3fx93kdxdgelhg8w4ntqj6za2txudm2t8ge649h5jcleqrrhk2ef4hymjtmly4mma07lgpru8e9j" }}
            ${"BTC invalid invoice preimage hash"}          | ${false} | ${""}        | ${{ ...reverseSwapBtc, invoice: "lnbcrt1m1pj8hjyjpp53ge8f7m79de2q3e4j8amvq9jq3g0eag9vymzyd32gjw3cz3uhjfqdqqcqzzsxqyz5vqsp52vdnu0n3yh8m0sykqk4gl6h9v7l4r736z4qswm8tmahvjet6w7uq9qyyssqytl6pnuel293xmkgnu9hc5f4taekhgl023zceztzy0eugya6908p5y0txdx0p0q448uru6ecqhd78aarr0lkj95h4s7nwrymjvnkdwcq2ds4qy" }}
            ${"BTC invalid redeem script claim public key"} | ${false} | ${""}        | ${{ ...reverseSwapBtc, redeemScript: "8201208763a91400884cd36bf1e5a1bfbe50b54e41bb0ab2dfebdd882103b9b0ea9a8ea9f7cd5c757c4753aa30d75ee1f9a1f97b87bc5d1a4174b35fe769677502ff00b17521037c7980160182adad9eaea06c1b1cdf9dfdce5ef865c386a112bff4a62196caf668ac" }}
            ${"BTC invalid redeem script preimage hash"}    | ${false} | ${""}        | ${{ ...reverseSwapBtc, redeemScript: "8201208763a9143ab4a6bb65bbf58652aac526832ead9461aeb939882103b9b0ea9a8ea9f7cd5c757c4753aa30d75ee149a1f97b87bc5d1a4174b35fe769677502ff00b17521036e2b63f3aa1f1e6b50438af9c505c25d3faeeb72414e84100a9ced7b5cddace168ac" }}
            ${"BTC invalid lockupAddress"}                  | ${false} | ${""}        | ${{ ...reverseSwapBtc, lockupAddress: "bcrt1qcqyj0mdse8ewusdxgm30ynsnqw4j5700vsdgm8xg0eft5rqdnpgs9ndhwx" }}
            ${"L-BTC valid"}                                | ${true}  | ${""}        | ${reverseSwapLbtc}
            ${"L-BTC invalid blinding key"}                 | ${false} | ${""}        | ${{ ...reverseSwapLbtc, blindingKey: "6aa614e75363a597e2fc093503856a5371ee198751a632305a434e9de72d800d" }}
        `(
            /*
            ${"RBTC valid"}                                 | ${true}  | ${EtherSwapBytecode.object} | ${{ ...reverseSwapBtc, asset: RBTC }}
            ${"RBTC invalid contract code"}                 | ${false} | ${"not correct"}            | ${{ ...reverseSwapBtc, asset: RBTC }}
        */
            "$desc",
            async ({ valid, contractCode, swap }) => {
                const contract = getEtherSwap(contractCode);
                await expect(
                    validateResponse(swap, contract, Buffer),
                ).resolves.toBe(valid);
            },
        );
    });
});

describe("validate invoices", () => {
    test.each`
        error                 | invoice
        ${"invalid_invoice"}  | ${"lnbcrt1pjkepjmpp5khv3s30apary2hry"}
        ${"invalid_0_amount"} | ${"lnbcrt1pjkepjmpp5khv3s30apary2hry5864d6t206jm7stpd4wv8sk3g3mfwp43x8wsdqqcqzzsxqyz5vqsp5hg3za92fpwwxfvme72vaa2vkmc4ukcuujpw8w6d2l4mr2jygku0q9qyyssqcqlhhtwc30jzdvszmva3maf74ytxw0pcyadt7wh6c2z9p7amp3rycfqa55lvyr825cepdh3fpgsuxxn9jj7vccrwg02lhj56awwgjtcq5f372c"}
        ${"invalid_0_amount"} | ${"lnbcrt1pjkez94sp5zk8dj2zyp3sng3v4xkp4m85yuuk2tqh5jw5dvrhu4atu79yrejwspp5cgrj9s3rqz80jth0ehhm7mxxtkruualungad73w78u7l2nrmqzcqdq9dfhnzxqyjw5qcqp2rzjqfvckvedaaankysf067nfn3pnapxc5jgruymhjy2ef80crkraq7xwqqq5qqqqqgqqqqqqqlgqqqqqqgq2q9qxpqysgqw4faj9q9p05m9jmrvvuumvaxdrr5ry40vp8me89ctcp3ex9ms5g5q3gkwegnqkzvzmmfdc6kepgyvqn6dssl87k2pc6rdv5pjxvwv8gqh2w9dc"}
    `("invalid invoice: $error", async ({ error, invoice }) => {
        try {
            validateInvoice(invoice);
        } catch (e) {
            expect(e.message).toEqual(t(error));
        }
    });
    test.each`
        invoice
        ${"lnbcrt10u1pjkepsqsp5lqav47x6j8e9flvg6fmghgut9rtlzxxnmud4n6v46xvvg79z0mdspp5xkeqqmhz7xws3yvmj9cm0tmz0wj0u7ntv2ecxstth2v7r4768qgqdq5g9kxy7fqd9h8vmmfvdjsxqr9mscqp2rzjqfvckvedaaankysf067nfn3pnapxc5jgruymhjy2ef80crkraq7xwqqq5qqqqqgqqqqqqqlgqqqqqqgq2q9qxpqysgqla9upqr2v0pz8a59l4ztjxjmrz3m826mx7z77ttsw8jml7yde2qpgurfl7g5t30fmttfn807p9cltzddk4cs4h3xeesf4p44jdzd9hgq0kmh4a"}
    `("valid invoice", async ({ invoice }) => {
        const sats = validateInvoice(invoice);
        expect(sats).toBeGreaterThan(0);
    });
});

describe("validate onchain addresses", () => {
    test.each`
        asset   | address
        ${BTC}  | ${"bcrt1q78qtnjrt53gauk6h2w32wane62jjg2gvval6w5"}
        ${BTC}  | ${"2NFjs5VkEHkX65QrZHwCgwXdphBvKPr6trL"}
        ${LBTC} | ${"VJL8BMWCv7HUq4dgCBJAQA1gHTWibWXPTjP1vXF92doTmpnD7a6b24t7epT3fXNi8nJfW2vYdLLf15vo"}
        ${LBTC} | ${"el1qqdmeywy40z2aasvaydsnmgqqqcgk92cvd9p9h4mpeh2x83dy79mhltd4al45ylxu33qsyu5l4z0srhagm5krl2n2cgxra5n88chxle7ctnpml5s983jr"}
    `("invalid address: $address", async ({ asset, address }) => {
        decodeAddress(asset, address);
    });
});
