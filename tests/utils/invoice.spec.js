import { describe, expect } from "vitest";
import {
    isLnurl,
    trimPrefix,
    trimBip21Lightning,
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
        expect(trimPrefix(invoice, "lightning:")).toEqual(invoice);
        expect(trimPrefix(`lightning:${invoice}`, "lightning:")).toEqual(
            invoice,
        );
        expect(trimPrefix(`LIGHTNING:${invoice}`, "lightning:")).toEqual(
            invoice,
        );
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
            "LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7" +
            "QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9C" +
            "HSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490" +
            "YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZX" +
            "C8C6T0SPJAZUP6";

        expect(trimBip21Lightning(bip21)).toEqual(invoice);
    });
});
