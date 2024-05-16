import log from "loglevel";

import Lock from "./lock";

// One week
export const logDeletionTime = 60 * 60 * 24 * 7;

export const getDate = (): string => {
    const date = new Date();
    return `${date.getUTCFullYear()}/${date.getUTCMonth()}/${date.getUTCDate()}`;
};

export const parseDate = (date: string): Date => {
    const split = date.split("/").map((split) => Number(split));

    const parsed = new Date();
    parsed.setUTCFullYear(split[0]);
    parsed.setUTCMonth(split[1]);
    parsed.setUTCDate(split[2]);

    return parsed;
};

export const deleteOldLogs = async (logsForage: LocalForage) => {
    const currentDate = new Date();
    await logsForage.iterate<string[], any>((_, date) => {
        const logDate = parseDate(date);

        // Delete logs older than logDeletionTime
        if (
            (currentDate.getTime() - logDate.getTime()) / 1000 <
            logDeletionTime
        ) {
            return;
        }

        log.debug(`deleting logs of ${date}`);
        logsForage.removeItem(date);
    });
};

export const formatLogLine = (message: any[]) =>
    message
        .map((entry: any) => {
            if (typeof entry === "object") {
                return JSON.stringify(entry);
            }

            return entry;
        })
        .join(" ");

export const injectLogWriter = (logsForage: LocalForage) => {
    const originalLogFactory = log.methodFactory;

    const logLock = new Lock();

    log.methodFactory = (methodName, logLevel, loggerName) => {
        const rawLogMethod = originalLogFactory(
            methodName,
            logLevel,
            loggerName,
        );

        return (...message: any[]) => {
            rawLogMethod(...message);

            const currentDate = getDate();

            logLock
                .acquire(async () => {
                    await logsForage.setItem(
                        currentDate,
                        (
                            (await logsForage.getItem<string[]>(currentDate)) ||
                            []
                        ).concat(formatLogLine(message)),
                    );
                })
                .then();
        };
    };
    log.rebuild();
};
