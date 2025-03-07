import { setConfig } from "../../src/config";
import {
    extractAddress,
    extractInvoice,
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
});
