import { Hex } from "viem";

export const trimPrefix = (str: string, prefix: string) => {
    if (str.startsWith(prefix)) {
        return str.slice(prefix.length);
    }

    return str;
};

export const ensureHex = (str?: null | string) => {
    if (str === null || str === undefined) {
        return null;
    }
    const result =
        typeof str === "string" && !str.startsWith("0x") ? `0x${str}` : str;
    return result as Hex;
};
