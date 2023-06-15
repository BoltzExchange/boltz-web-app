import { describe } from "vitest";
import { trimLightningPrefix } from "../../src/utils/invoice";

describe("invoice", () => {
    test("should trim lightning: prefix of invoices", () => {
        const invoice = "lnbcrt4986620n1pjgkj07pp5zl";

        expect(trimLightningPrefix(invoice)).toEqual(invoice);
        expect(trimLightningPrefix(`lightning:${invoice}`)).toEqual(invoice);
        expect(trimLightningPrefix(`LIGHTNING:${invoice}`)).toEqual(invoice);
    });
});
