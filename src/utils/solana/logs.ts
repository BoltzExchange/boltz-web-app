export const formatSolanaLogsMessage = (
    logs: string[] | undefined | null,
): string =>
    logs === undefined || logs === null || logs.length === 0
        ? ""
        : `\nLogs:\n${logs.join("\n")}`;
