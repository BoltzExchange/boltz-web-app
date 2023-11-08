import { describe, expect } from "vitest";
import { defaultLanguage } from "../../src/config";
import { getNavigatorLanguage } from "../../src/i18n/detect";

describe("getNavigatorLanguage", () => {
    test.each`
        navigatorLanguage | expected
        ${"en-US"}        | ${"en"}
        ${"de-DE"}        | ${"de"}
        ${"es-ES"}        | ${"es"}
        ${"de"}           | ${"de"}
        ${"none-DE"}      | ${defaultLanguage}
        ${"ro-RO"}        | ${defaultLanguage}
        ${undefined}      | ${defaultLanguage}
    `(
        "getNavigatorLanguage $navigatorLanguage <=> $expected",
        ({ navigatorLanguage, expected }) => {
            expect(getNavigatorLanguage(navigatorLanguage)).toEqual(expected);
        },
    );
});
