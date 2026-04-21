import docMarkdown from "../../docs/urlParams.md?raw";
import { config } from "../../src/configs/mainnet";
import { LN } from "../../src/consts/Assets";

const parseDocumentedAssetsFromUrlParamsDoc = (markdown: string): string[] => {
    const sectionStartRe = /^## Assets\s*$/m;
    const startMatch = sectionStartRe.exec(markdown);
    if (startMatch === null) {
        throw new Error("docs/urlParams.md: missing ## Assets section");
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
        const expected = [LN, ...Object.keys(config.assets)];

        const documented = parseDocumentedAssetsFromUrlParamsDoc(docMarkdown);

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
});
