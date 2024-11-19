import bolt11 from "bolt11";

import { setConfig } from "../../src/config";
import {
    checkInvoicePreimage,
    decodeInvoice,
    extractAddress,
    extractInvoice,
    getExpiryEtaHours,
    isBip21,
    isInvoice,
    isLnurl,
} from "../../src/utils/invoice";

describe("invoice", () => {
    test.each`
        expected | data
        ${true}  | ${"m@lnurl.some.domain"}
        ${true}  | ${"lightning:m@lnurl.some.domain"}
        ${true}  | ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
        ${true}  | ${"lightning:LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
        ${true}  | ${"m@boltz.exchange"}
        ${true}  | ${"lightning:m@boltz.exchange"}
        ${false} | ${"m@lnurl@bol.tz"}
        ${false} | ${"m@lnurl"}
        ${false} | ${"m@lnurl."}
        ${false} | ${"lnurl.some.domain"}
        ${false} | ${"LNURL1DP6fasdklfjasdf"}
    `(
        "should determine if $data is lnurl ($expected)",
        ({ data, expected }) => {
            expect(isLnurl(data)).toEqual(expected);
        },
    );

    test("should trim lightning: prefix of invoices", () => {
        const invoice = "lnbcrt4986620n1pjgkj07pp5zl";

        expect(extractInvoice(invoice)).toEqual(invoice);
        expect(extractInvoice(`lightning:${invoice}`)).toEqual(invoice);
        expect(extractInvoice(`LIGHTNING:${invoice}`)).toEqual(invoice);
        expect(extractInvoice(`lightning:${invoice}?label=test`)).toEqual(
            invoice,
        );
    });

    test.each`
        result   | prefix
        ${true}  | ${"bitcoin:"}
        ${true}  | ${"BITCOIN:"}
        ${true}  | ${"liquidnetwork:"}
        ${false} | ${"liquid:"}
        ${false} | ${"boltz:"}
    `("should be bip21 $prefix -> $result", ({ result, prefix }) => {
        expect(isBip21(prefix)).toEqual(result);
    });

    test.each`
        bip21                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | invoice
        ${"bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightning=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6"}                                                                                                                          | ${"lnbc10u1p3pj257pp5yztkwjcz5ftl5laxkav23zmzekaw37zk6kmv80pk4xaev5qhtz7qdpdwd3xger9wd5kwm36yprx7u3qd36kucmgyp282etnv3shjcqzpgxqyz5vqsp5usyc4lk9chsfp53kvcnvq456ganh60d89reykdngsmtj6yw3nhvq9qyyssqjcewm5cjwz4a6rfjx77c490yced6pemk0upkxhy89cmm7sct66k8gneanwykzgdrwrfje69h9u5u0w57rrcsysas7gadwmzxc8c6t0spjazup6"}
        ${"liquidnetwork:el1qq2hwpl8uvskkjrznyltjlamk86nh7r69amjmj2kvfwe7pxmfjxl5wjnhvd5am8s7mnv5rtnwflkcgfwesnz2gz8qau0ghppzehf4grt89szq8tex5keq?amount=0.00100135&label=Send%20to%20BTC%20lightning&assetid=5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225&lightning=lnbc10u1p3pj257pp5yztkwjcz5ftl5laxkav23zmzekaw37zk6kmv80pk4xaev5qhtz7qdpdwd3xger9wd5kwm36yprx7u3qd36kucmgyp282etnv3shjcqzpgxqyz5vqsp5usyc4lk9chsfp53kvcnvq456ganh60d89reykdngsmtj6yw3nhvq9qyyssqjcewm5cjwz4a6rfjx77c490yced6pemk0upkxhy89cmm7sct66k8gneanwykzgdrwrfje69h9u5u0w57rrcsysas7gadwmzxc8c6t0spjazup6"} | ${"lnbc10u1p3pj257pp5yztkwjcz5ftl5laxkav23zmzekaw37zk6kmv80pk4xaev5qhtz7qdpdwd3xger9wd5kwm36yprx7u3qd36kucmgyp282etnv3shjcqzpgxqyz5vqsp5usyc4lk9chsfp53kvcnvq456ganh60d89reykdngsmtj6yw3nhvq9qyyssqjcewm5cjwz4a6rfjx77c490yced6pemk0upkxhy89cmm7sct66k8gneanwykzgdrwrfje69h9u5u0w57rrcsysas7gadwmzxc8c6t0spjazup6"}
    `("should trim bip21 lightning invoice", ({ bip21, invoice }) => {
        expect(extractInvoice(bip21)).toEqual(invoice);
    });

    test.each`
        bip21                                                                                                                                                                                                                                                                    | address
        ${"bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday"}                                                                                                                          | ${"BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U"}
        ${"liquidnetwork:el1qq2hwpl8uvskkjrznyltjlamk86nh7r69amjmj2kvfwe7pxmfjxl5wjnhvd5am8s7mnv5rtnwflkcgfwesnz2gz8qau0ghppzehf4grt89szq8tex5keq?amount=0.00100135&label=Send%20to%20BTC%20lightning&assetid=5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225"} | ${"el1qq2hwpl8uvskkjrznyltjlamk86nh7r69amjmj2kvfwe7pxmfjxl5wjnhvd5am8s7mnv5rtnwflkcgfwesnz2gz8qau0ghppzehf4grt89szq8tex5keq"}
        ${"bitcoin:3G4bhXLN64wGN6efUd4MoHjmxBWrUNacPY?amount=0.00183723&label=Send%20to%20BTC%20lightning"}                                                                                                                                                                      | ${"3G4bhXLN64wGN6efUd4MoHjmxBWrUNacPY"}
        ${"liquidnetwork:VJL8BMWCv7HUq4dgCBJAQA1gHTWibWXPTjP1vXF92doTmpnD7a6b24t7epT3fXNi8nJfW2vYdLLf15vo"}                                                                                                                                                                      | ${"VJL8BMWCv7HUq4dgCBJAQA1gHTWibWXPTjP1vXF92doTmpnD7a6b24t7epT3fXNi8nJfW2vYdLLf15vo"}
    `("should trim bip21 address: $bip21", ({ bip21, address }) => {
        expect(extractAddress(bip21)).toEqual(address);
    });

    test.each`
        bip21
        ${"bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday"}
        ${"liquidnetwork:el1qq2hwpl8uvskkjrznyltjlamk86nh7r69amjmj2kvfwe7pxmfjxl5wjnhvd5am8s7mnv5rtnwflkcgfwesnz2gz8qau0ghppzehf4grt89szq8tex5keq?amount=0.00100135&label=Send%20to%20BTC%20lightning&assetid=5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225"}
    `("should not return invoice on bip21 address: $bip21", ({ bip21 }) => {
        expect(extractInvoice(bip21)).toEqual("");
    });

    test("should coalesce null invoice amount", async () => {
        expect(
            (
                await decodeInvoice(
                    "lnbc1pju362upp5ah2vx45gwx2tafgrpducjh60cytf53jf2tarwstyntamhjm6m7sscqpjsp5ecndxet53f8f2cmwcg4md5776dy4qhcmaga538lpvmr26r50svqq9q7sqqqqqqqqqqqqqqqqqqqsqqqqqysgqdqqmqz9gxqyjw5qrzjqwryaup9lh50kkranzgcdnn2fgvx390wgj5jd07rwr3vxeje0glclllkjfxe6ccyfsqqqqlgqqqqqeqqjqx73yrwsnw4qrgq3cv7q3pl7lqyl3c3xyxht0d4v3xfvwsvhlgu0n02zzcgvgt5ndkxl4tel5ae00ffmxd2kta8jnfw4e47ppjys7sgcpp90pnr",
                )
            ).satoshis,
        ).toEqual(0);
    });

    describe("decode invoices", () => {
        test.each`
            network      | invoice
            ${"regtest"} | ${"lnbcrt623210n1pj8hfdspp5mhcxq3qgzn779zs0c02na32henclzt55uga68kck6tknyw0y59qsdqqcqzzsxqyz5vqsp54wll9s5jphgcjqzpnamqeszvfdz937pjels2cqr84pltjsqv2asq9qyyssq49028nqec7uz5vk73peg5a4fkxhltw90kkmupfradjp0sus6g5zxs6njedk8ml3qgdls3dfjfvd7z3py5qgst9fnzz5pwcr5564sf6sqtrlfzz"}
            ${"testnet"} | ${"lntb4573450n1pj8hfnmsp58erxc4m9u09frqkalhw5udgvghvm27wewl99d7z3hjftgwtt234qpp572p5y0tplt70txw35kzypsef4mg2pwp5u0ej9hx8tse6f2rcvrjsdq5g9kxy7fqd9h8vmmfvdjsxqyjw5qcqp2rzjq0cxp9fmaadhwlw80ez2lgu9n5pzlsd803238r0tyv4dwf27s6wqqfggesqqqfqqqyqqqqlgqqqqqqgq9q9qyysgqw4msvmfgakcmxkglwnj7qgp6hlupefstyzhkld0uxlx3gdncnzw385c5qy6ng2qh59rtttktjzy8l43gzv3n9u6du64z2xu0mdz377splwf2qy"}
            ${"mainnet"} | ${"lnbc678450n1pj8hf4kpp5kxh4x93kvxt43q0k0q6t3fp6gfhgusqxsajj6lcexsrg4lzm7rrqdq5g9kxy7fqd9h8vmmfvdjscqzzsxqyz5vqsp5n4rzwr2lzw68082ws4tjjerp2t5eluny75xx54jr530x073tvvzs9qyyssq3f43e2mzqx07zzt529ux480nj00908p3u5qdwhyuk3qrcepaqsjxqjhcnfde4ta74c3dkxkhwscxfhdm5v0y7qh7np22v9xc220taacqjanm3m"}
        `("should decode $network invoices", async ({ invoice }) => {
            await expect(decodeInvoice(invoice)).resolves.toMatchSnapshot();
        });
    });

    describe("Expiry Eta hours", () => {
        test.each`
            invoice
            ${"lnbcrt623210n1pj8hfdspp5mhcxq3qgzn779zs0c02na32henclzt55uga68kck6tknyw0y59qsdqqcqzzsxqyz5vqsp54wll9s5jphgcjqzpnamqeszvfdz937pjels2cqr84pltjsqv2asq9qyyssq49028nqec7uz5vk73peg5a4fkxhltw90kkmupfradjp0sus6g5zxs6njedk8ml3qgdls3dfjfvd7z3py5qgst9fnzz5pwcr5564sf6sqtrlfzz"}
        `("should decode eta time expired", async ({ invoice }) => {
            await expect(getExpiryEtaHours(invoice)).resolves.toEqual(0);
        });

        test.each`
            delta
            ${12}
            ${24}
        `("expiry eta in $delta hours", async ({ delta }) => {
            const now = +new Date() / 1000;
            const encoded = bolt11.encode({
                satoshis: 2000,
                timestamp: now,
                tags: [
                    {
                        tagName: "payment_hash",
                        data: "0001020304050607080900010203040506070809000102030405060708090102",
                    },
                    {
                        tagName: "expire_time",
                        data: delta * 60 * 60,
                    },
                ],
            });
            // sign takes the encoded object and the private key as arguments
            const privateKeyHex =
                "e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734";
            const signed = bolt11.sign(encoded, privateKeyHex);
            await expect(
                getExpiryEtaHours(signed.paymentRequest),
            ).resolves.toEqual(delta);
        });
    });

    describe("isInvoice", () => {
        test.each`
            expected | network      | invoice
            ${true}  | ${"regtest"} | ${"lnbcrt623210n1pj8hfdspp5mhcxq3qgzn779zs0c02na32henclzt55uga68kck6tknyw0y59qsdqqcqzzsxqyz5vqsp54wll9s5jphgcjqzpnamqeszvfdz937pjels2cqr84pltjsqv2asq9qyyssq49028nqec7uz5vk73peg5a4fkxhltw90kkmupfradjp0sus6g5zxs6njedk8ml3qgdls3dfjfvd7z3py5qgst9fnzz5pwcr5564sf6sqtrlfzz"}
            ${true}  | ${"mainnet"} | ${"lnbc678450n1pj8hf4kpp5kxh4x93kvxt43q0k0q6t3fp6gfhgusqxsajj6lcexsrg4lzm7rrqdq5g9kxy7fqd9h8vmmfvdjscqzzsxqyz5vqsp5n4rzwr2lzw68082ws4tjjerp2t5eluny75xx54jr530x073tvvzs9qyyssq3f43e2mzqx07zzt529ux480nj00908p3u5qdwhyuk3qrcepaqsjxqjhcnfde4ta74c3dkxkhwscxfhdm5v0y7qh7np22v9xc220taacqjanm3m"}
            ${false} | ${"mainnet"} | ${"lnbcrt623210n1pj8hfdspp5mhcxq3qgzn779zs0c02na32henclzt55uga68kck6tknyw0y59qsdqqcqzzsxqyz5vqsp54wll9s5jphgcjqzpnamqeszvfdz937pjels2cqr84pltjsqv2asq9qyyssq49028nqec7uz5vk73peg5a4fkxhltw90kkmupfradjp0sus6g5zxs6njedk8ml3qgdls3dfjfvd7z3py5qgst9fnzz5pwcr5564sf6sqtrlfzz"}
        `(
            "should detect $invoice as invoice",
            ({ expected, network, invoice }) => {
                setConfig({ network } as never);
                expect(isInvoice(invoice)).toEqual(expected);
            },
        );
    });

    describe("checkInvoicePreimage", () => {
        test.each`
            preimage                                                              | invoice
            ${"4c8176e16eab0a2282bb47ac8dfceddabffa73e849ea9b6662c44f868a2b4d2a"} | ${"lnbcrt1m1pnnvd2tpp55g70uxevgu3ddpkkn8yvwu6ehvme7lr464gdv7thelmzjz7fyqsqdqqcqzzsxqyz5vqsp5l6n65lrnqmp7lhx9wen493zvkg9gfrksx0lren5m34wy5ge2x6fq9p4gqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpqysgqdxrky9sy3sk6zuh6x9gtga2trtqapyj69zel0lp6xv8xmrqzst3ja2mxsfsaq7ccffnl27pyzyhj8t8eylq792khl3ha3x8qgxca87qpfyqk7l"}
        `(
            "should check preimage for invoice",
            async ({ invoice, preimage }) => {
                await checkInvoicePreimage(invoice, preimage);
            },
        );

        test("should fail when preimage is invalid", async () => {
            await expect(
                checkInvoicePreimage(
                    "lnbcrt1m1pnnvd2tpp55g70uxevgu3ddpkkn8yvwu6ehvme7lr464gdv7thelmzjz7fyqsqdqqcqzzsxqyz5vqsp5l6n65lrnqmp7lhx9wen493zvkg9gfrksx0lren5m34wy5ge2x6fq9p4gqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpqysgqdxrky9sy3sk6zuh6x9gtga2trtqapyj69zel0lp6xv8xmrqzst3ja2mxsfsaq7ccffnl27pyzyhj8t8eylq792khl3ha3x8qgxca87qpfyqk7l",
                    "ab",
                ),
            ).rejects.toEqual("invalid preimage");
        });
    });
});
