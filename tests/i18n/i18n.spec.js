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
                    `${JSON.stringify(
                        Array.from(langSet.values()),
                        undefined,
                        2,
                    )} missing from ${comp}`,
                ).toEqual([]);
            }
        }
    });
});
