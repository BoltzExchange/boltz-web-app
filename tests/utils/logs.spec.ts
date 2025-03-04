import log from "loglevel";

import {
    deleteOldLogs,
    formatLogLine,
    getDate,
    injectLogWriter,
    logDeletionTime,
    parseDate,
} from "../../src/utils/logs";

/* eslint-disable @typescript-eslint/unbound-method */

describe("logs", () => {
    beforeAll(() => {
        vi.stubGlobal("console", {});
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        log.setLevel("error");
    });

    test("should get current date", () => {
        const date = new Date();

        expect(getDate()).toEqual(
            `${date.getUTCFullYear()}/${date.getUTCMonth()}/${date.getUTCDate()}`,
        );
    });

    test("should parse date", () => {
        const date = parseDate("2024/05/16");

        expect(date.getUTCFullYear()).toEqual(2024);
        expect(date.getUTCMonth()).toEqual(5);
        expect(date.getUTCDate()).toEqual(16);
    });

    test("should delete logs after a week", async () => {
        const oldDate = new Date();
        oldDate.setTime(oldDate.getTime() - logDeletionTime * 1000);
        oldDate.setUTCDate(oldDate.getUTCDate() - 1);
        const oldDates = [
            "2022/01/01",
            `${oldDate.getUTCFullYear()}/${oldDate.getUTCMonth()}/${oldDate.getUTCDate()}`,
        ];

        const forage = {
            iterate: (cb: (value: string[], date: string) => void) => {
                cb(["log1", "log2"], oldDates[0]);
                cb([], oldDates[1]);
                cb([], getDate());
            },
            removeItem: vi.fn(),
        } as unknown as LocalForage;

        await deleteOldLogs(forage);

        expect(forage.removeItem).toHaveBeenCalledTimes(oldDates.length);
        expect(forage.removeItem).toHaveBeenCalledWith(oldDates[0]);
        expect(forage.removeItem).toHaveBeenCalledWith(oldDates[1]);
    });

    test.each`
        line                             | expected
        ${["some", "strings"]}           | ${"some strings"}
        ${["some", { data: "objects" }]} | ${'some {"data":"objects"}'}
    `("should format log lines for storage", ({ line, expected }) => {
        expect(formatLogLine(line)).toEqual(expected);
    });

    test.each`
        existingLogs
        ${undefined}
        ${null}
        ${[]}
    `(
        "should inject into the log writer and write new entries when no existing logs are found",
        async ({ existingLogs }) => {
            const forage = {
                getItem: vi.fn().mockResolvedValue(existingLogs),
                setItem: vi.fn(),
            } as unknown as LocalForage;

            injectLogWriter(forage);
            log.setLevel("trace");

            const logMessage = "test message";
            log.debug(logMessage);

            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });

            expect(forage.getItem).toHaveBeenCalledTimes(1);
            expect(forage.getItem).toHaveBeenCalledWith(getDate());
            expect(forage.setItem).toHaveBeenCalledTimes(1);
            expect(forage.setItem).toHaveBeenCalledWith(getDate(), [
                logMessage,
            ]);
        },
    );

    test("should inject into the log writer and append to existing logs", async () => {
        const existingLogs = ["i was here first"];

        const forage = {
            getItem: vi.fn().mockResolvedValue(existingLogs),
            setItem: vi.fn(),
        } as unknown as LocalForage;

        injectLogWriter(forage);
        log.setLevel("trace");

        const logMessage = "test message";
        log.debug(logMessage);

        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });

        expect(forage.getItem).toHaveBeenCalledTimes(1);
        expect(forage.getItem).toHaveBeenCalledWith(getDate());
        expect(forage.setItem).toHaveBeenCalledTimes(1);
        expect(forage.setItem).toHaveBeenCalledWith(getDate(), [
            ...existingLogs,
            logMessage,
        ]);
    });
});
