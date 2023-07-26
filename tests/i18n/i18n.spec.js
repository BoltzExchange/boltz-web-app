import { describe, expect } from "vitest";
import dict from "../../src/i18n/i18n";

describe("i18n", () => {
    test("should have same strings for all languages", () => {
        const langs = Object.entries(dict);

        for (const [lang, langStrs] of langs) {
            for (const [comp, compStrs] of langs) {
                if (lang === comp) {
                    continue;
                }

                expect(Object.keys(langStrs).sort()).toEqual(
                    Object.keys(compStrs).sort()
                );
            }
        }
    });
});
