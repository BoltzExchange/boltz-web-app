import type { Address, Hex } from "viem";

export type AlchemyCall = {
    to: Address;
    data?: Hex;
    value?: string;
};
