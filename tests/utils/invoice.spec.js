import { describe, expect } from "vitest";
import {
    isLnurl,
    extractInvoice,
    extractBip21,
    extractBip21Invoice,
} from "../../src/utils/invoice";

describe("invoice", () => {
    test.each`
        data                                                                             | expected
        ${"m@lnurl.some.domain"}                                                         | ${true}
        ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"} | ${true}
        ${"lnurl.some.domain"}                                                           | ${false}
        ${"LNURL1DP6fasdklfjasdf"}                                                       | ${false}
    `(
        "should determine if $data is lnurl ($expected)",
        ({ data, expected }) => {
            expect(isLnurl(data)).toEqual(expected);
        },
    );

    test("should trim lightning: prefix of invoices", () => {
        const invoice = "lnbcrt4986620n1pjgkj07pp5zl";
        expect(extractInvoice(invoice, "lightning:")).toEqual(invoice);
        expect(extractInvoice(`lightning:${invoice}`, "lightning:")).toEqual(
            invoice,
        );
        expect(extractInvoice(`LIGHTNING:${invoice}`, "lightning:")).toEqual(
            invoice,
        );
        expect(
            extractInvoice(`lightning:${invoice}?label=test`, "lightning:"),
        ).toEqual(invoice);
    });

    test("should trim bip21 lightning invoice", () => {
        const bip21 =
            "bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=" +
            "sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightn" +
            "ing=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7" +
            "QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9C" +
            "HSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490" +
            "YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZX" +
            "C8C6T0SPJAZUP6";
        const invoice =
            "lnbc10u1p3pj257pp5yztkwjcz5ftl5laxkav23zmzekaw37zk6kmv80pk4xaev5qhtz7" +
            "qdpdwd3xger9wd5kwm36yprx7u3qd36kucmgyp282etnv3shjcqzpgxqyz5vqsp5usyc4lk9c" +
            "hsfp53kvcnvq456ganh60d89reykdngsmtj6yw3nhvq9qyyssqjcewm5cjwz4a6rfjx77c490" +
            "yced6pemk0upkxhy89cmm7sct66k8gneanwykzgdrwrfje69h9u5u0w57rrcsysas7gadwmzx" +
            "c8c6t0spjazup6";

        expect(extractBip21Invoice(bip21)).toEqual(invoice);
    });

    test("should trim bip21 address", () => {
        const bip21 =
            "bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=" +
            "sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday";
        const address = "bc1qylh3u67j673h6y6alv70m0pl2yz53tzhvxgg7u";

        expect(extractBip21(bip21)).toEqual(address);
    });
});
