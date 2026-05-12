import type { Address, Hex } from "viem";

export interface RouterContract {
    address: Address;
    read: {
        TYPEHASH_SEND_DATA: () => Promise<Hex>;
    };
}
