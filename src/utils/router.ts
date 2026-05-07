import { type Address, type Hex, getAddress } from "viem";

export type RouterCall = {
    target: Address;
    value: bigint;
    callData: Hex;
};

export type LooseRouterCall = {
    target: string;
    value: string | bigint;
    callData: string;
};

export const toRouterCalls = (
    calls: readonly LooseRouterCall[],
): RouterCall[] =>
    calls.map((call) => ({
        target: getAddress(call.target),
        value: BigInt(call.value),
        callData: call.callData as Hex,
    }));
