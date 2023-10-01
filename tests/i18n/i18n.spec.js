import { describe, expect } from "vitest";
import { rawDict } from "../../src/i18n/i18n";

describe("i18n", () => {
    test("should have same strings for all languages", () => {
        const langs = Object.entries(rawDict);

        for (const [lang, langStrs] of langs) {
            for (const [comp, compStrs] of langs) {
                if (lang === comp) {
                    continue;
                }

                const langSet = new Set(Object.keys(langStrs));
                const compSet = new Set(Object.keys(compStrs));

                compSet.forEach((val) => langSet.delete(val));

                expect(
                    Array.from(langSet.values()),
                    `${Array.from(langSet.values())} missing from ${comp}`
                ).toEqual([]);
            }
        }
    });
});
