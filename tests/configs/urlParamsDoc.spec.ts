import docMarkdown from "../../docs/urlParams.md?raw";
import { config } from "../../src/configs/mainnet";
import { LN } from "../../src/consts/Assets";
import { Currency } from "../../src/consts/Enums";

const parseDocumentedValuesFromSection = (
    markdown: string,
    sectionHeading: string,
): string[] => {
    const sectionStartRe = new RegExp(`^## ${sectionHeading}\\s*$`, "m");
    const startMatch = sectionStartRe.exec(markdown);
    if (startMatch === null) {
        throw new Error(
            `docs/urlParams.md: missing ## ${sectionHeading} section`,
        );
    }

    const fromHeading = markdown.slice(startMatch.index + startMatch[0].length);
    const nextHeading = fromHeading.search(/\n## /);
    const section =
        nextHeading === -1 ? fromHeading : fromHeading.slice(0, nextHeading);

    const documented: string[] = [];
    const lineRe = /^- `([^`]+)`/gm;
    let match: RegExpExecArray | null;
    while ((match = lineRe.exec(section)) !== null) {
        documented.push(match[1]);
    }
    return documented;
};

describe("docs/urlParams.md", () => {
    test("documents every sendAsset/receiveAsset value for mainnet", () => {
        const expected = [LN, ...Object.keys(config.assets ?? {})];

        const documented = parseDocumentedValuesFromSection(
            docMarkdown,
            "Assets",
        );

        const missing = expected.filter((a) => !documented.includes(a));
        const stale = documented.filter((a) => !expected.includes(a));

        expect(
            missing,
            `Add to docs/urlParams.md ## Assets: ${missing.join(", ")}`,
        ).toEqual([]);
        expect(
            stale,
            `Remove from docs/urlParams.md ## Assets: ${stale.join(", ")}`,
        ).toEqual([]);
    });

    test("documents every fiatCurrency value", () => {
        const expected = Object.values(Currency);

        const documented = parseDocumentedValuesFromSection(
            docMarkdown,
            "Fiat currency",
        );

        const missing = expected.filter((c) => !documented.includes(c));
        const stale = documented.filter(
            (c) => !(expected as string[]).includes(c),
        );

        expect(
            missing,
            `Add to docs/urlParams.md ## Fiat currency: ${missing.join(", ")}`,
        ).toEqual([]);
        expect(
            stale,
            `Remove from docs/urlParams.md ## Fiat currency: ${stale.join(", ")}`,
        ).toEqual([]);
    });
});
