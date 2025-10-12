import { rawDict } from "../../src/i18n/i18n";

const getNestedStructure = (
    obj: Record<string, unknown>,
    path: string = "",
): Map<string, "string" | "object"> => {
    const structure = new Map<string, "string" | "object">();

    for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;

        if (typeof value === "object" && value !== null) {
            structure.set(fullPath, "object");
            const nested = getNestedStructure(
                value as Record<string, unknown>,
                fullPath,
            );
            nested.forEach((type, nestedPath) => {
                structure.set(nestedPath, type);
            });
        } else {
            structure.set(fullPath, "string");
        }
    }

    return structure;
};

const extractPlaceholders = (text: string): Set<string> => {
    const placeholders = new Set<string>();
    const regex = /\{\{\s*(\w+)\s*\}\}/g;

    let match: ReturnType<typeof regex.exec>;
    while ((match = regex.exec(text)) !== null) {
        placeholders.add(match[1]);
    }

    return placeholders;
};

const findEmptyValues = (
    obj: Record<string, unknown>,
    path: string = "",
): string[] => {
    const emptyPaths: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;

        if (typeof value === "object" && value !== null) {
            emptyPaths.push(
                ...findEmptyValues(value as Record<string, unknown>, fullPath),
            );
        } else if (
            value === "" ||
            value === null ||
            value === undefined ||
            (typeof value === "string" && value.trim() === "")
        ) {
            emptyPaths.push(fullPath);
        }
    }

    return emptyPaths;
};

const collectAllPlaceholders = (
    obj: Record<string, unknown>,
    path: string = "",
): Map<string, Set<string>> => {
    const placeholders = new Map<string, Set<string>>();

    for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;

        if (typeof value === "object" && value !== null) {
            const nested = collectAllPlaceholders(
                value as Record<string, unknown>,
                fullPath,
            );
            nested.forEach((placeholderSet, nestedPath) => {
                placeholders.set(nestedPath, placeholderSet);
            });
        } else if (typeof value === "string") {
            const extracted = extractPlaceholders(value);
            if (extracted.size > 0) {
                placeholders.set(fullPath, extracted);
            }
        }
    }

    return placeholders;
};

describe("i18n", () => {
    test("should have same strings for all languages", () => {
        const langs = Object.entries(rawDict);
        const referenceKeys = new Set(Object.keys(rawDict.en));

        // Check each language against the reference (English)
        for (const [lang, langStrs] of langs) {
            const langKeys = new Set(Object.keys(langStrs));

            const missing = Array.from(referenceKeys).filter(
                (key) => !langKeys.has(key),
            );
            if (missing.length > 0) {
                console.log(
                    `Language "${lang}" is missing keys:\n${JSON.stringify(
                        missing,
                        undefined,
                        2,
                    )}`,
                );
                expect(missing).toEqual([]);
            }

            const extra = Array.from(langKeys).filter(
                (key) => !referenceKeys.has(key),
            );
            if (extra.length > 0) {
                console.log(
                    `Language "${lang}" has extra keys not in English:\n${JSON.stringify(
                        extra,
                        undefined,
                        2,
                    )}`,
                );
                expect(extra).toEqual([]);
            }
        }
    });

    test("should have consistent nested object structures", () => {
        const langs = Object.entries(rawDict);
        const enStructure = getNestedStructure(rawDict.en);

        for (const [lang, langStrs] of langs) {
            if (lang === "en") continue;

            const langStructure = getNestedStructure(
                langStrs as Record<string, unknown>,
            );

            const mismatches: string[] = [];

            enStructure.forEach((enType, path) => {
                const langType = langStructure.get(path);

                if (!langType) {
                    mismatches.push(
                        `  - "${path}": missing in ${lang} (type: ${enType} in English)`,
                    );
                } else if (enType !== langType) {
                    mismatches.push(
                        `  - "${path}": type mismatch (${enType} in English, ${langType} in ${lang})`,
                    );
                }
            });

            langStructure.forEach((langType, path) => {
                if (!enStructure.has(path)) {
                    mismatches.push(
                        `  - "${path}": extra key in ${lang} (not in English)`,
                    );
                }
            });

            if (mismatches.length > 0) {
                console.log(
                    `Language "${lang}" has nested structure mismatches:\n${mismatches.join("\n")}`,
                );
                expect(mismatches).toEqual([]);
            }
        }
    });

    test("should have consistent placeholders across all languages", () => {
        const langs = Object.entries(rawDict);
        const enPlaceholders = collectAllPlaceholders(rawDict.en);

        for (const [lang, langStrs] of langs) {
            if (lang === "en") continue;

            const langPlaceholders = collectAllPlaceholders(
                langStrs as Record<string, unknown>,
            );
            const issues: string[] = [];

            enPlaceholders.forEach((enSet, path) => {
                const langSet = langPlaceholders.get(path);

                if (!langSet) {
                    // Path doesn't exist in this language (caught by other tests)
                    return;
                }

                const enArray = Array.from(enSet).sort();
                const langArray = Array.from(langSet).sort();

                // Check for missing placeholders
                const missing = enArray.filter((p) => !langSet.has(p));
                if (missing.length > 0) {
                    issues.push(
                        `  - "${path}": missing placeholders in ${lang}: ${missing.map((p) => `{{ ${p} }}`).join(", ")}`,
                    );
                }

                // Check for extra placeholders
                const extra = langArray.filter((p) => !enSet.has(p));
                if (extra.length > 0) {
                    issues.push(
                        `  - "${path}": extra placeholders in ${lang}: ${extra.map((p) => `{{ ${p} }}`).join(", ")}`,
                    );
                }
            });

            if (issues.length > 0) {
                console.log(
                    `Language "${lang}" has placeholder mismatches:\n${issues.join("\n")}`,
                );
                expect(issues).toEqual([]);
            }
        }
    });

    test("should not have empty or undefined values", () => {
        const langs = Object.entries(rawDict);

        for (const [lang, langStrs] of langs) {
            const emptyValues = findEmptyValues(
                langStrs as Record<string, unknown>,
            );

            if (emptyValues.length > 0) {
                console.log(
                    `Language "${lang}" has empty/undefined values:\n${JSON.stringify(
                        emptyValues,
                        undefined,
                        2,
                    )}`,
                );
                expect(emptyValues).toEqual([]);
            }
        }
    });
});
