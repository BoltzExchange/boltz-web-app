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

        // Mock navigator.locks API
        vi.stubGlobal("navigator", {
            locks: {
                request: vi.fn((name, callback) => {
                    return Promise.resolve(callback());
                }),
            },
        });
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        log.setLevel("error");
    });

    describe("getDate", () => {
        test("should add 1 to month", () => {
            const date = new Date("2025-11-16T12:00:00Z");
            vi.setSystemTime(date);

            expect(getDate()).toEqual(`2025/11/16`);
        });

        test("should 0 pad the day", () => {
            const date = new Date("2025-11-03T12:00:00Z");
            vi.setSystemTime(date);

            expect(getDate()).toEqual(`2025/11/03`);
        });

        test("should 0 pad the month", () => {
            const date = new Date("2025-02-13T12:00:00Z");
            vi.setSystemTime(date);

            expect(getDate()).toEqual(`2025/02/13`);
        });
    });

    test("should parse date", () => {
        const date = parseDate("2024/05/16");

        expect(date.getUTCFullYear()).toEqual(2024);
        expect(date.getUTCMonth()).toEqual(5 - 1);
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
        const fixedDate = new Date("2025-10-14T08:14:36.616Z");
        vi.setSystemTime(fixedDate);
        const timestamp = fixedDate.toISOString();
        expect(formatLogLine(line)).toEqual(`${timestamp} ${expected}`);
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
            const fixedDate = new Date("2025-10-14T08:14:36.616Z");
            vi.setSystemTime(fixedDate);
            log.debug(logMessage);

            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });

            expect(forage.getItem).toHaveBeenCalledTimes(1);
            expect(forage.getItem).toHaveBeenCalledWith(getDate());
            expect(forage.setItem).toHaveBeenCalledTimes(1);
            const timestamp = fixedDate.toISOString();
            expect(forage.setItem).toHaveBeenCalledWith(getDate(), [
                `${timestamp} ${logMessage}`,
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
        const fixedDate = new Date("2025-10-14T08:14:36.616Z");
        vi.setSystemTime(fixedDate);
        log.debug(logMessage);

        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });

        expect(forage.getItem).toHaveBeenCalledTimes(1);
        expect(forage.getItem).toHaveBeenCalledWith(getDate());
        expect(forage.setItem).toHaveBeenCalledTimes(1);
        const timestamp = fixedDate.toISOString();
        expect(forage.setItem).toHaveBeenCalledWith(getDate(), [
            ...existingLogs,
            `${timestamp} ${logMessage}`,
        ]);
    });

    test("should use navigator.locks when writing logs", async () => {
        const forage = {
            getItem: vi.fn().mockResolvedValue([]),
            setItem: vi.fn(),
        } as unknown as LocalForage;

        injectLogWriter(forage);
        log.setLevel("trace");

        const logMessage = "test with locks";
        log.debug(logMessage);

        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });

        // Verify that navigator.locks.request was called with the correct lock name
        expect(navigator.locks.request).toHaveBeenCalled();
        expect(navigator.locks.request).toHaveBeenCalledWith(
            "logLock",
            expect.any(Function),
        );
    });
});
