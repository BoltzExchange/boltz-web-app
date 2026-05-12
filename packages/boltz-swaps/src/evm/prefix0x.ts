import type { Hex } from "viem";

export const prefix0x = (val: string): Hex =>
    (val.startsWith("0x") ? val : `0x${val}`) as Hex;
