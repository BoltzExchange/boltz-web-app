import { describe, expect } from "vitest";

import { isLnurl, trimLightningPrefix } from "../../src/utils/invoice";

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

        expect(trimLightningPrefix(invoice)).toEqual(invoice);
        expect(trimLightningPrefix(`lightning:${invoice}`)).toEqual(invoice);
        expect(trimLightningPrefix(`LIGHTNING:${invoice}`)).toEqual(invoice);
    });
});
