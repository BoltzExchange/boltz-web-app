import type { Hex } from "viem";

export const prefix0x = (val: string): Hex =>
    (val.startsWith("0x") ? val : `0x${val}`) as Hex;

export const stripHexPrefix = (value: string): string =>
    value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
