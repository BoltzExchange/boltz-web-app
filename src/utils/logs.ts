import type { Logger } from "boltz-swaps/logger";
import log from "loglevel";

// One week
export const logDeletionTime = 60 * 60 * 24 * 7;

const zeroPad = (value: number) => {
    return value < 10 ? `0${value}` : `${value}`;
};

export const getDate = (): string => {
    const date = new Date();
    return `${date.getUTCFullYear()}/${zeroPad(date.getUTCMonth() + 1)}/${zeroPad(date.getUTCDate())}`;
};

export const parseDate = (date: string): Date => {
    const split = date.split("/").map((split) => Number(split));

    const parsed = new Date();
    parsed.setTime(0);
    parsed.setUTCFullYear(split[0]);
    parsed.setUTCMonth(split[1] - 1);
    parsed.setUTCDate(split[2]);

    return parsed;
};

const replaceBigInt = (_key: string, value: unknown) => {
    return typeof value === "bigint" ? value.toString() : value;
};

type PersistedLogMethod = "trace" | "debug" | "info" | "warn" | "error" | "log";

let logWriter: LocalForage | undefined;

export const deleteOldLogs = async (logsForage: LocalForage) => {
    const currentDate = new Date();
    await logsForage.iterate<string[], unknown>((_, date) => {
        const logDate = parseDate(date);

        // Delete logs older than logDeletionTime
        if (
            (currentDate.getTime() - logDate.getTime()) / 1000 <
            logDeletionTime
        ) {
            return;
        }

        log.debug(`deleting logs of ${date}`);
        void logsForage.removeItem(date);
    });
};

export const formatLogLine = (message: unknown[]) => {
    const timestamp = new Date().toISOString(); // ISO 8601 format with milliseconds (UTC)
    const formattedMessage =
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        message
            .map((entry: unknown) => {
                if (entry instanceof Error) {
                    return entry;
                }
                if (typeof entry === "object") {
                    return JSON.stringify(entry, replaceBigInt);
                }

                return entry;
            })
            .join(" ");
    return `${timestamp} ${formattedMessage}`;
};

export const injectLogWriter = (logsForage: LocalForage) => {
    logWriter = logsForage;
};

const getMethodLevel = (methodName: PersistedLogMethod) => {
    return methodName === "log"
        ? log.levels.DEBUG
        : log.levels[methodName.toUpperCase() as keyof typeof log.levels];
};

export const persistLogLine = <T extends unknown[]>(
    methodName: PersistedLogMethod,
    message: T,
) => {
    if (
        logWriter === undefined ||
        log.getLevel() > getMethodLevel(methodName)
    ) {
        return message;
    }

    const currentDate = getDate();

    if (navigator.locks === undefined) {
        throw new Error("Window is not in a secure context");
    }

    const writer = logWriter;
    navigator.locks
        .request("logLock", async () => {
            try {
                await writer.setItem(
                    currentDate,
                    (
                        (await writer.getItem<string[]>(currentDate)) || []
                    ).concat(formatLogLine(message)),
                );
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error("Failed to persist log line", e);
            }
        })
        .catch((e) => {
            // eslint-disable-next-line no-console
            console.error("Failed to acquire log lock", e);
        });

    return message;
};

const persistAndForward =
    (
        methodName: PersistedLogMethod,
        forward: (...message: unknown[]) => void,
    ) =>
    (...message: unknown[]) => {
        forward(...persistLogLine(methodName, message));
    };

export const persistedLoglevelLogger: Logger = {
    trace: persistAndForward("trace", (...message) => log.trace(...message)),
    debug: persistAndForward("debug", (...message) => log.debug(...message)),
    info: persistAndForward("info", (...message) => log.info(...message)),
    warn: persistAndForward("warn", (...message) => log.warn(...message)),
    error: persistAndForward("error", (...message) => log.error(...message)),
    log: persistAndForward("log", (...message) => log.log(...message)),
};
