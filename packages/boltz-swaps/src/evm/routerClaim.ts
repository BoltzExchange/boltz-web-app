import {
    type Address,
    type Signature,
    encodeFunctionData,
    getAddress,
    parseSignature,
} from "viem";

import { type LooseRouterCall, toRouterCalls } from "../bridge/router.ts";
import { vFromSignature } from "../bridge/signature.ts";
import { routerAbi } from "../generated/evm-abis.ts";
import type { Signer } from "../interfaces/signer.ts";
import type { Erc20SwapContract, RouterContract } from "./contracts.ts";
import { prefix0x } from "./prefix0x.ts";
import type { PopulatedEvmTransaction } from "./transaction.ts";

export const signErc20ClaimToRouter = async (
    signer: Signer,
    erc20Swap: Erc20SwapContract,
    chainId: bigint,
    preimage: string,
    amount: bigint,
    tokenAddress: string,
    refundAddress: string,
    timeoutBlockHeight: number,
    routerAddress: string,
): Promise<Signature> => {
    const version = await erc20Swap.read.version();

    return parseSignature(
        await signer.signTypedData({
            account: signer.account,
            domain: {
                name: "ERC20Swap",
                version: String(version),
                verifyingContract: erc20Swap.address,
                chainId,
            },
            types: {
                Claim: [
                    { name: "preimage", type: "bytes32" },
                    { name: "amount", type: "uint256" },
                    { name: "tokenAddress", type: "address" },
                    { name: "refundAddress", type: "address" },
                    { name: "timelock", type: "uint256" },
                    { name: "destination", type: "address" },
                ],
            } as const,
            primaryType: "Claim",
            message: {
                preimage: prefix0x(preimage),
                amount,
                tokenAddress: getAddress(tokenAddress),
                refundAddress: getAddress(refundAddress),
                timelock: BigInt(timeoutBlockHeight),
                destination: getAddress(routerAddress),
            },
        }),
    );
};

export const signRouterClaim = async (
    signer: Signer,
    routerAddress: string,
    chainId: bigint,
    preimage: string,
    finalToken: string,
    minAmountOut: bigint,
    destination: string,
): Promise<Signature> =>
    parseSignature(
        await signer.signTypedData({
            account: signer.account,
            domain: {
                name: "Router",
                version: "2",
                verifyingContract: getAddress(routerAddress),
                chainId,
            },
            types: {
                Claim: [
                    { name: "preimage", type: "bytes32" },
                    { name: "token", type: "address" },
                    { name: "minAmountOut", type: "uint256" },
                    { name: "destination", type: "address" },
                ],
            } as const,
            primaryType: "Claim",
            message: {
                preimage: prefix0x(preimage),
                token: getAddress(finalToken),
                minAmountOut,
                destination: getAddress(destination),
            },
        }),
    );

export type DexEncodedCalls = ReadonlyArray<{
    calls: ReadonlyArray<{ to: string; value: string | bigint; data: string }>;
}>;

export const dexCalldataToRouterCalls = (
    calldata: DexEncodedCalls,
): LooseRouterCall[] =>
    calldata.flatMap(({ calls }) =>
        calls.map((call) => ({
            target: call.to,
            value: call.value,
            callData: prefix0x(call.data),
        })),
    );

export type RouterClaimExecuteArgs = {
    router: RouterContract;
    preimage: string;
    amount: bigint;
    tokenAddress: string;
    refundAddress: string;
    timeoutBlockHeight: number;
    claimSignature: Signature;
    routerCalls: readonly LooseRouterCall[];
    finalToken: string;
    minAmountOut: bigint;
    destination: string;
    routerSignature: Signature;
};

export const encodeRouterClaimExecuteTx = (
    args: RouterClaimExecuteArgs,
): PopulatedEvmTransaction => ({
    to: args.router.address as Address,
    data: encodeFunctionData({
        abi: routerAbi,
        functionName: "claimERC20Execute",
        args: [
            {
                preimage: prefix0x(args.preimage),
                amount: args.amount,
                tokenAddress: getAddress(args.tokenAddress),
                refundAddress: getAddress(args.refundAddress),
                timelock: BigInt(args.timeoutBlockHeight),
                v: vFromSignature(args.claimSignature),
                r: args.claimSignature.r,
                s: args.claimSignature.s,
            },
            toRouterCalls(args.routerCalls),
            getAddress(args.finalToken),
            args.minAmountOut,
            getAddress(args.destination),
            vFromSignature(args.routerSignature),
            args.routerSignature.r,
            args.routerSignature.s,
        ],
    }),
});
