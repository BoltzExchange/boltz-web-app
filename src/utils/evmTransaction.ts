import log from "loglevel";
import type { Accessor } from "solid-js";
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

import {
    type AlchemyCall,
    type SendAlchemyTransactionOptions,
    sendTransaction as sendAlchemyTransaction,
    toAlchemyCall,
} from "../alchemy/Alchemy";
import { AssetKind, getKindForAsset, getTokenAddress } from "../consts/Assets";
import type { Signer } from "../context/Web3";
import type {
    Erc20SwapContract,
    EtherSwapContract,
} from "../context/contracts";
import { erc20Abi, erc20SwapAbi, etherSwapAbi } from "../generated/evm-abis";
import { relayClaimTransaction } from "../rif/Signer";
import { satsToAssetAmount } from "./rootstock";
import { GasAbstractionType } from "./swapCreator";

export const prefix0x = (val: string): Hex =>
    (val.startsWith("0x") ? val : `0x${val}`) as Hex;

export type LockupEvent = {
    preimageHash: Hex;
    amount: bigint;
    tokenAddress?: Address;
    claimAddress: Address;
    refundAddress: Address;
    timelock: bigint;
    logIndex: number;
};

type SwapAbi = typeof etherSwapAbi | typeof erc20SwapAbi;

type SendPopulatedTransactionOptions = {
    alchemy?: SendAlchemyTransactionOptions;
};

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

const transactionHashFromResponse = (response: unknown): Hash => {
    if (typeof response === "string") {
        return response as Hash;
    }
    if (typeof response === "object" && response !== null) {
        const hash = Reflect.get(response, "hash");
        if (typeof hash === "string") {
            return hash as Hash;
        }
    }
    throw new Error("transaction response did not include a hash");
};

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

export const sendPopulatedTransaction = async (
    gasAbstraction: GasAbstractionType,
    signer: Signer,
    transaction: PopulatedEvmTransaction | AlchemyCall[],
    options?: SendPopulatedTransactionOptions,
): Promise<Hash> => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay: {
            if (Array.isArray(transaction)) {
                throw new Error("Transaction is an array of Alchemy calls");
            }

            log.debug(
                "Sending transaction via signer",
                transaction.to,
                transaction.data,
            );
            // viem's `sendTransaction` discriminates between legacy / EIP-1559
            // / blob branches; `PopulatedEvmTransaction` deliberately stays
            // mode-agnostic because we receive it from upstream populators that
            // pick the mode at runtime. Cast through `never` to bypass the
            // exhaustive discriminator on the request shape.
            const params = {
                account:
                    signer.account.type === "local"
                        ? signer.account
                        : signer.address,
                chain: null,
                ...transaction,
            } as never;
            const response = await signer.sendTransaction(params);
            return transactionHashFromResponse(response);
        }

        case GasAbstractionType.Signer: {
            const calls = Array.isArray(transaction)
                ? transaction
                : [toAlchemyCall(transaction)];
            log.debug("Sending transaction via Alchemy", calls);

            const chainId = BigInt(await signer.provider.getChainId());
            return await sendAlchemyTransaction(
                signer,
                chainId,
                calls,
                options?.alchemy,
            );
        }

        default: {
            const exhaustiveCheck: never = gasAbstraction;
            throw new Error(
                `Unsupported gas abstraction type: ${String(exhaustiveCheck)}`,
            );
        }
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
    signer: Accessor<Signer>,
    getGasAbstractionSigner: Signer,
    etherSwap: EtherSwapContract,
    erc20Swap: Erc20SwapContract,
): Promise<ClaimResult> => {
    const assetAmount = satsToAssetAmount(amount, asset);

    switch (gasAbstraction) {
        case GasAbstractionType.RifRelay:
            return {
                transactionHash: await relayClaimTransaction(
                    signer(),
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
                signer(),
                getGasAbstractionSigner,
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
                    transactionHash: await sendPopulatedTransaction(
                        gasAbstraction,
                        claimSigner,
                        calls,
                    ),
                    receiveAmount: assetAmount,
                };
            }

            return {
                transactionHash: await sendPopulatedTransaction(
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
