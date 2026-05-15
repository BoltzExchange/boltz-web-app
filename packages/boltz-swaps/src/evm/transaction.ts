import {
    type Address,
    type Hash,
    type Hex,
    type TransactionReceipt,
    encodeFunctionData,
    getAddress,
    isAddressEqual,
    parseEventLogs,
} from "viem";

import { getKindForAsset, getTokenAddress } from "../config.ts";
import { erc20Abi, erc20SwapAbi, etherSwapAbi } from "../generated/evm-abis.ts";
import type { AlchemyCall } from "../interfaces/alchemy.ts";
import type { Signer } from "../interfaces/signer.ts";
import { AssetKind, GasAbstractionType, type LockupEvent } from "../types.ts";
import type { Erc20SwapContract, EtherSwapContract } from "./contracts.ts";
import { prefix0x } from "./prefix0x.ts";
import { satsToAssetAmount } from "./rootstock.ts";

export type PopulatedEvmTransaction = {
    to?: Address;
    data?: Hex;
    value?: bigint;
    gas?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    nonce?: number;
};

type SwapAbi = typeof etherSwapAbi | typeof erc20SwapAbi;

export type SendTransactionFn = (
    gasAbstraction: GasAbstractionType,
    signer: Signer,
    transaction: PopulatedEvmTransaction | AlchemyCall[],
) => Promise<Hash>;

export type RelayClaimTransactionFn = (
    signer: Signer,
    etherSwap: EtherSwapContract,
    preimage: string,
    amount: number | bigint,
    refundAddress: Address,
    timeoutBlockHeight: number,
) => Promise<string>;

export const getSignerForGasAbstraction = (
    gasAbstraction: GasAbstractionType,
    signer: Signer | undefined,
    gasAbstractionSigner: Signer,
): Signer | undefined => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay:
            return signer;

        case GasAbstractionType.Signer:
            return gasAbstractionSigner;
    }
};

export const getLockupEvent = (
    abi: SwapAbi,
    receipt: Pick<TransactionReceipt, "logs">,
    contractAddress: Address,
): LockupEvent => {
    const [lockupLog] = parseEventLogs({
        abi,
        eventName: "Lockup",
        logs: receipt.logs,
    }).filter((eventLog) => isAddressEqual(eventLog.address, contractAddress));

    if (lockupLog === undefined) {
        throw new Error("could not find commitment lockup event");
    }

    const { args } = lockupLog;
    return {
        amount: args.amount,
        tokenAddress: "tokenAddress" in args ? args.tokenAddress : undefined,
        claimAddress: args.claimAddress,
        refundAddress: args.refundAddress,
        timelock: args.timelock,
        preimageHash: args.preimageHash,
        logIndex: lockupLog.logIndex ?? 0,
    };
};

export type ClaimResult = {
    transactionHash: string;
    receiveAmount: bigint;
};

export const claimAsset = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number | bigint,
    claimAddress: Address,
    refundAddress: Address,
    timeoutBlockHeight: number,
    destination: Address,
    getSigner: () => Signer,
    gasAbstractionSigner: Signer,
    etherSwap: EtherSwapContract,
    erc20Swap: Erc20SwapContract,
    sendTransaction: SendTransactionFn,
    relayClaimTransaction?: RelayClaimTransactionFn,
): Promise<ClaimResult> => {
    const assetAmount = satsToAssetAmount(amount, asset);

    switch (gasAbstraction) {
        case GasAbstractionType.RifRelay:
            if (relayClaimTransaction === undefined) {
                throw new Error(
                    "RifRelay claim requires a relayClaimTransaction callback",
                );
            }
            return {
                transactionHash: await relayClaimTransaction(
                    getSigner(),
                    etherSwap,
                    preimage,
                    amount,
                    refundAddress,
                    timeoutBlockHeight,
                ),
                receiveAmount: assetAmount,
            };

        case GasAbstractionType.None:
        case GasAbstractionType.Signer: {
            const claimSigner = getSignerForGasAbstraction(
                gasAbstraction,
                getSigner(),
                gasAbstractionSigner,
            );
            if (claimSigner === undefined) {
                throw new Error("missing claim signer");
            }

            const isErc20 = getKindForAsset(asset) !== AssetKind.EVMNative;
            const tx = isErc20
                ? ({
                      to: erc20Swap.address,
                      data: encodeFunctionData({
                          abi: erc20SwapAbi,
                          functionName: "claim",
                          args: [
                              prefix0x(preimage),
                              assetAmount,
                              getAddress(getTokenAddress(asset)),
                              getAddress(claimAddress),
                              getAddress(refundAddress),
                              BigInt(timeoutBlockHeight),
                          ],
                      }),
                  } satisfies PopulatedEvmTransaction)
                : ({
                      to: etherSwap.address,
                      data: encodeFunctionData({
                          abi: etherSwapAbi,
                          functionName: "claim",
                          args: [
                              prefix0x(preimage),
                              assetAmount,
                              getAddress(claimAddress),
                              getAddress(refundAddress),
                              BigInt(timeoutBlockHeight),
                          ],
                      }),
                  } satisfies PopulatedEvmTransaction);

            if (
                gasAbstraction === GasAbstractionType.Signer &&
                isErc20 &&
                !isAddressEqual(claimAddress, destination)
            ) {
                const calls: AlchemyCall[] = [
                    { to: tx.to, data: tx.data },
                    {
                        to: getTokenAddress(asset) as Address,
                        data: encodeFunctionData({
                            abi: erc20Abi,
                            functionName: "transfer",
                            args: [getAddress(destination), assetAmount],
                        }),
                    },
                ];
                return {
                    transactionHash: await sendTransaction(
                        gasAbstraction,
                        claimSigner,
                        calls,
                    ),
                    receiveAmount: assetAmount,
                };
            }

            return {
                transactionHash: await sendTransaction(
                    gasAbstraction,
                    claimSigner,
                    tx,
                ),
                receiveAmount: assetAmount,
            };
        }

        default: {
            const exhaustiveCheck: never = gasAbstraction;
            throw new Error(
                `Unsupported gas abstraction type: ${String(exhaustiveCheck)}`,
            );
        }
    }
};
