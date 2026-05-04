import { type APIRequestContext, expect, test } from "@playwright/test";
import { SourceMapConsumer } from "source-map-js";

type CapturedConsoleMessage = {
    text: string;
    location: {
        url: string;
        lineNumber: number;
        columnNumber: number;
    };
};

const consumerCache = new Map<string, SourceMapConsumer | null>();

const loadSourceMap = async (
    request: APIRequestContext,
    bundleUrl: string,
): Promise<SourceMapConsumer | null> => {
    if (consumerCache.has(bundleUrl)) {
        return consumerCache.get(bundleUrl) ?? null;
    }

    const bundle = await (await request.get(bundleUrl)).text();
    const match = bundle.match(/\/\/[#@] sourceMappingURL=(\S+)\s*$/m);

    if (match === null) {
        consumerCache.set(bundleUrl, null);
        return null;
    }

    const reference = match[1];
    let rawMap: string;

    if (reference.startsWith("data:")) {
        const comma = reference.indexOf(",");
        const meta = reference.slice(5, comma);
        const payload = reference.slice(comma + 1);
        rawMap = meta.includes(";base64")
            ? Buffer.from(payload, "base64").toString("utf8")
            : decodeURIComponent(payload);
    } else {
        rawMap = await (
            await request.get(new URL(reference, bundleUrl).toString())
        ).text();
    }

    const consumer = new SourceMapConsumer(JSON.parse(rawMap));
    consumerCache.set(bundleUrl, consumer);
    return consumer;
};

const resolveOriginalSource = async (
    request: APIRequestContext,
    location: CapturedConsoleMessage["location"],
): Promise<string> => {
    const consumer = await loadSourceMap(request, location.url);

    if (consumer === null) {
        return location.url;
    }

    const original = consumer.originalPositionFor({
        line: location.lineNumber + 1,
        column: location.columnNumber,
    });

    return original.source ?? location.url;
};

const appLogTypes = new Set(["debug", "error", "info", "log", "warning"]);

const expectedStartupLogs = [
    {
        name: "version",
        match: /^Version /,
        source: "/src/context/Global.tsx",
        required: true,
    },
    {
        name: "language detection",
        match: /^detected browser language /,
        source: "/src/i18n/detect.ts",
        required: true,
    },
];

const findMatchingMessage = (
    messages: CapturedConsoleMessage[],
    match: RegExp,
) => messages.find((message) => match.test(message.text));

test.describe("Logs", () => {
    test("preserves app call sites in browser console output", async ({
        page,
        request,
    }) => {
        const consoleMessages: CapturedConsoleMessage[] = [];

        page.on("console", (message) => {
            if (!appLogTypes.has(message.type())) {
                return;
            }

            consoleMessages.push({
                text: message.text(),
                location: message.location(),
            });
        });

        await page.goto("/");

        const requiredLogs = expectedStartupLogs.filter(
            (expectedLog) => expectedLog.required,
        );

        await expect
            .poll(
                () =>
                    requiredLogs.every(
                        (expectedLog) =>
                            findMatchingMessage(
                                consoleMessages,
                                expectedLog.match,
                            ) !== undefined,
                    ),
                {
                    timeout: 10_000,
                },
            )
            .toBe(true);

        for (const expectedLog of expectedStartupLogs) {
            const message = findMatchingMessage(
                consoleMessages,
                expectedLog.match,
            );

            if (message === undefined) {
                expect(expectedLog.required).toBe(false);
                continue;
            }

            const { url } = message.location;

            expect(
                url,
                `${expectedLog.name} log should not be attributed to the persistence helper`,
            ).not.toContain("/src/utils/logs.ts");
            expect(
                url,
                `${expectedLog.name} log should not be attributed to Vite's console bridge`,
            ).not.toContain("/@vite/client");

            const resolvedSource = url.includes("/src/")
                ? url
                : await resolveOriginalSource(request, message.location);

            expect(
                resolvedSource,
                `${expectedLog.name} log should point at its source file (resolved via sourcemap when bundled)`,
            ).toContain(expectedLog.source);
        }
    });
});
