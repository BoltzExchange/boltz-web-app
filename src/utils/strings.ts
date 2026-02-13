import type { Hex } from "viem";

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
    return (str.startsWith("0x") ? str : `0x${str}`) as Hex;
};
