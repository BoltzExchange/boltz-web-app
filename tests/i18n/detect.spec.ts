import { config } from "../../src/config";
import { getNavigatorLanguage } from "../../src/i18n/detect";

describe("detect", () => {
    test.each`
        navigatorLanguage | expected
        ${"en-US"}        | ${"en"}
        ${"en-UK"}        | ${"en"}
        ${"de-DE"}        | ${"de"}
        ${"de-AT"}        | ${"de"}
        ${"de-CH"}        | ${"de"}
        ${"de-LUX"}       | ${"de"}
        ${"es-ES"}        | ${"es"}
        ${"de"}           | ${"de"}
        ${"none-DE"}      | ${config.defaultLanguage}
        ${"ro-RO"}        | ${config.defaultLanguage}
        ${undefined}      | ${config.defaultLanguage}
    `(
        "getNavigatorLanguage $navigatorLanguage <=> $expected",
        ({ navigatorLanguage, expected }) => {
            expect(getNavigatorLanguage(navigatorLanguage)).toEqual(expected);
        },
    );
});
