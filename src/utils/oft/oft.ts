import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { hex } from "@scure/base";
import {
    type ContractRunner,
    MaxUint256,
    ZeroAddress,
    concat,
    getBytes,
    solidityPacked,
    zeroPadValue,
} from "ethers";
import type { Wallet } from "ethers";
import log from "loglevel";
import { getBridgeMesh } from "src/consts/Assets";
import { createTokenContract } from "src/context/Web3";
import type { Signer } from "src/context/Web3";

import type { AlchemyCall } from "../../alchemy/Alchemy";
import { config } from "../../config";
import { NetworkTransport, Usdt0Kind } from "../../configs/base";
import { clearCache, getCachedValue } from "../cache";
import {
    encodeSolanaAtaCreationOption,
    encodeSolanaRecipient,
    getSolanaConnection,
    getSolanaRentExemptMinimumBalance,
    getSolanaTransactionSender,
    shouldCreateSolanaTokenAccount,
    solanaTokenAccountSize,
} from "../chains/solana";
import { decodeTronBase58Address } from "../chains/tron";
import {
    type Provider,
    createAssetProvider,
    requireRpcUrls,
} from "../provider";
import type { EvmOftTransportClient } from "./evm";
import {
    createEvmOftContract,
    getEvmOftReceivedEvent,
    getEvmOftReceivedEventByGuid,
    getEvmOftSentEvent,
} from "./evm";
import {
    type OftContract,
    defaultOftName,
    formatRoute,
    getOftChain,
    getOftContract,
} from "./registry";
import {
    createSolanaOftContract,
    getSolanaOftTokenBalance as getSolanaLegacyMeshTokenBalance,
} from "./solana";
import type {
    MsgFee,
    OftFeeDetail,
    OftLimit,
    OftNativeDrop,
    OftQuoteOptions,
    OftReceipt,
    OftReceiveQuote,
    OftReceivedEvent,
    OftRoute,
    OftSentEvent,
    OftTransportClient,
    OftTransportRunner,
    SendParam,
} from "./types";

export type {
    MsgFee,
    OftNativeDrop,
    OftQuoteOptions,
    OftReceiveQuote,
    OftReceivedEvent,
    OftSentEvent,
    OftTransportClient,
    SendParam,
} from "./types";

const providerCachePrefix = "oft:provider:";
const executorNativeAmountExceedsCapSelector = "0x0084ce02";
const type3Option = 3;
const executorWorkerId = 1;
const optionTypeLzReceive = 1;
const optionTypeNativeDrop = 2;
const hundredPercentBps = 10_000n;
const legacyBridgeFeeBps = 3n;

const getErrorData = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null) {
        return undefined;
    }

    const candidate = error as {
        data?: unknown;
        error?: unknown;
        info?: {
            error?: unknown;
        };
    };

    if (typeof candidate.data === "string") {
        return candidate.data;
    }

    return getErrorData(candidate.error) ?? getErrorData(candidate.info?.error);
};

export const isExecutorNativeAmountExceedsCapError = (
    error: unknown,
): boolean =>
    getErrorData(error)?.startsWith(executorNativeAmountExceedsCapSelector) ??
    false;

export const decodeExecutorNativeAmountExceedsCapError = (
    error: unknown,
):
    | {
          amount: bigint;
          cap: bigint;
      }
    | undefined => {
    const data = getErrorData(error);
    if (
        data === undefined ||
        !data.startsWith(executorNativeAmountExceedsCapSelector) ||
        data.length < 138
    ) {
        return undefined;
    }

    return {
        amount: BigInt(`0x${data.slice(10, 74)}`),
        cap: BigInt(`0x${data.slice(74, 138)}`),
    };
};

export const clearOftDeployments = () => {
    clearCache();
};

export const getOftTransport = (asset: string): NetworkTransport => {
    const transport = config.assets?.[asset]?.network?.transport;
    if (transport === undefined) {
        throw new Error(`missing OFT transport for asset ${asset}`);
    }

    return transport;
};

export const getOftProvider = (sourceAsset: string): Provider => {
    if (getOftTransport(sourceAsset) !== NetworkTransport.Evm) {
        throw new Error(
            `OFT JSON-RPC provider is only available for EVM assets, got ${getOftTransport(sourceAsset)}`,
        );
    }

    const rpcUrls = requireRpcUrls(sourceAsset);
    return getCachedValue(
        providerCachePrefix,
        `${sourceAsset}:${rpcUrls.join(",")}`,
        () => {
            const provider = createAssetProvider(sourceAsset);
            log.debug("Created OFT provider", {
                sourceAsset,
                rpcUrlCount: rpcUrls.length,
            });
            return provider;
        },
    );
};

const getOftStoreContract = async (
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftContract> => {
    const chain = await getOftChain(route.sourceAsset, route, oftName);
    const contract = chain?.contracts.find(
        (candidate) => candidate.name === "OFT Store",
    );
    if (contract === undefined) {
        throw new Error(
            `Missing OFT store contract for route ${formatRoute(route)} and OFT ${oftName}`,
        );
    }

    return contract;
};

const isSolanaWalletProvider = (
    runner: OftTransportRunner,
): runner is SolanaWalletProvider =>
    runner !== undefined && "signAndSendTransaction" in runner;

const getEvmOftRunner = (
    route: OftRoute,
    runner: OftTransportRunner,
): ContractRunner => {
    if (runner === undefined) {
        return getOftProvider(route.sourceAsset);
    }
    if (isSolanaWalletProvider(runner)) {
        throw new Error(
            `Expected an EVM runner for OFT route ${formatRoute(route)}`,
        );
    }

    return runner;
};

const getSolanaOftWalletProvider = (
    route: OftRoute,
    runner: OftTransportRunner,
): SolanaWalletProvider | undefined => {
    if (runner === undefined) {
        return undefined;
    }
    if (isSolanaWalletProvider(runner)) {
        return runner;
    }

    throw new Error(
        `Expected a Solana wallet provider for OFT route ${formatRoute(route)}`,
    );
};

export const createOftContract = async (
    route: OftRoute,
    runner?: OftTransportRunner,
    oftName = defaultOftName,
): Promise<OftTransportClient> => {
    const sourceTransport = getOftTransport(route.sourceAsset);
    const oftContract = await getOftContract(route, oftName);

    switch (sourceTransport) {
        case NetworkTransport.Evm:
            return createEvmOftContract(
                oftContract.address,
                getEvmOftRunner(route, runner),
            );

        case NetworkTransport.Solana: {
            const oftStore = await getOftStoreContract(route, oftName);
            return createSolanaOftContract({
                asset: route.sourceAsset,
                programAddress: oftContract.address,
                storeAddress: oftStore.address,
                walletProvider: getSolanaOftWalletProvider(route, runner),
            });
        }

        case NetworkTransport.Tron:
            throw new Error(
                `OFT sending is not implemented for ${NetworkTransport.Tron} yet`,
            );

        default: {
            const exhaustiveCheck: never = sourceTransport;
            throw new Error(
                `Unhandled OFT transport: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

export const getQuotedOftContract = (
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftTransportClient> => createOftContract(route, undefined, oftName);

const requireEvmOftClient = (
    contract: OftTransportClient,
    operation: string,
): EvmOftTransportClient => {
    if (contract.transport !== NetworkTransport.Evm) {
        throw new Error(`${operation} requires an EVM OFT client`);
    }

    return contract as EvmOftTransportClient;
};

export const getOftSentEvent = (
    contract: OftTransportClient,
    receipt: Parameters<typeof getEvmOftSentEvent>[1],
    contractAddress: string,
): OftSentEvent =>
    getEvmOftSentEvent(
        requireEvmOftClient(contract, "OFTSent decoding"),
        receipt,
        contractAddress,
    );

export const getOftSentGuid = (
    contract: OftTransportClient,
    receipt: Parameters<typeof getEvmOftSentEvent>[1],
    contractAddress: string,
): string => getOftSentEvent(contract, receipt, contractAddress).guid;

export const getOftReceivedGuid = (
    contract: OftTransportClient,
    receipt: Parameters<typeof getEvmOftReceivedEvent>[1],
    contractAddress: string,
): string =>
    getEvmOftReceivedEvent(
        requireEvmOftClient(contract, "OFT receive lookup"),
        receipt,
        contractAddress,
    ).guid;

export const getOftReceivedEventByGuid = async (
    contract: OftTransportClient,
    provider: Pick<Provider, "getLogs">,
    contractAddress: string,
    guid: string,
): Promise<OftReceivedEvent | undefined> =>
    await getEvmOftReceivedEventByGuid(
        requireEvmOftClient(contract, "OFT receive lookup"),
        provider,
        contractAddress,
        guid,
    );

const newOptions = (): string => solidityPacked(["uint16"], [type3Option]);

const encodeRecipient = (
    transport: NetworkTransport,
    recipient: string,
): string => {
    switch (transport) {
        case NetworkTransport.Evm:
            return zeroPadValue(recipient, 32);

        case NetworkTransport.Solana:
            return encodeSolanaRecipient(recipient);

        case NetworkTransport.Tron:
            return zeroPadValue(
                `0x${hex.encode(decodeTronBase58Address(recipient))}`,
                32,
            );
    }
};

const encodeOftRecipient = (
    asset: string,
    recipient: string | undefined,
): string => {
    if (recipient === undefined) {
        return encodeRecipient(NetworkTransport.Evm, ZeroAddress);
    }

    return encodeRecipient(getOftTransport(asset), recipient);
};

const addExecutorOption = (
    options: string,
    optionType: number,
    option: string,
): string => {
    const optionSize = getBytes(option).length + 1;

    return concat([
        options,
        solidityPacked(["uint8"], [executorWorkerId]),
        solidityPacked(["uint16"], [optionSize]),
        solidityPacked(["uint8"], [optionType]),
        option,
    ]);
};

const appendExecutorOption = (
    options: string,
    optionType: number,
    option: string,
): string =>
    addExecutorOption(
        options === "0x" ? newOptions() : options,
        optionType,
        option,
    );

const buildOftExtraOptions = (
    destinationAsset: string,
    nativeDrop: OftNativeDrop | undefined,
    createSolanaTokenAccount: boolean,
): string => {
    let options = "0x";

    if (createSolanaTokenAccount) {
        options = appendExecutorOption(
            options,
            optionTypeLzReceive,
            encodeSolanaAtaCreationOption(),
        );
    }

    if (nativeDrop === undefined || nativeDrop.amount <= 0n) {
        return options;
    }

    const nativeDropReceiver = encodeOftRecipient(
        destinationAsset,
        nativeDrop.receiver,
    );

    const option = solidityPacked(
        ["uint128", "bytes32"],
        [nativeDrop.amount, nativeDropReceiver],
    );

    return appendExecutorOption(options, optionTypeNativeDrop, option);
};

const ceilDiv = (numerator: bigint, denominator: bigint): bigint => {
    if (denominator <= 0n) {
        throw new Error("denominator must be greater than zero");
    }

    return (numerator + denominator - 1n) / denominator;
};

const getLegacyMeshSourceAmount = (destinationAmount: bigint): bigint => {
    if (legacyBridgeFeeBps >= hundredPercentBps) {
        throw new Error("legacyBridgeFeeBps must be less than 100%");
    }

    return ceilDiv(
        destinationAmount * hundredPercentBps,
        hundredPercentBps - legacyBridgeFeeBps,
    );
};

export const getBufferedOftNativeFee = (nativeFee: bigint): bigint =>
    (nativeFee * 110n) / 100n;

export const getRequiredSolanaOftNativeBalance = async (
    asset: string,
    nativeFee: bigint,
): Promise<bigint> => {
    const bufferedFee = getBufferedOftNativeFee(nativeFee);
    const rentExemptMinimum = await getSolanaRentExemptMinimumBalance(
        asset,
        solanaTokenAccountSize,
    );

    return bufferedFee > rentExemptMinimum ? bufferedFee : rentExemptMinimum;
};

const createOftSendParam = async (
    route: OftRoute,
    recipient: string | undefined,
    amount: bigint,
    oftName = defaultOftName,
    extraOptions = "0x",
): Promise<SendParam> => {
    const lzEid = (await getOftChain(route.destinationAsset, route, oftName))
        ?.lzEid;
    if (lzEid === undefined) {
        throw new Error(
            `Missing LayerZero endpoint id for route ${formatRoute(route)} and OFT ${oftName}`,
        );
    }

    return [
        Number(lzEid),
        encodeOftRecipient(route.destinationAsset, recipient),
        amount,
        0n,
        extraOptions,
        "0x",
        "0x",
    ];
};

export const quoteOftSend = async (
    oft: OftTransportClient,
    route: OftRoute,
    recipient: string | undefined,
    amount: bigint,
    { oftName = defaultOftName, nativeDrop }: OftQuoteOptions = {},
): Promise<{
    sendParam: SendParam;
    msgFee: MsgFee;
    oftLimit: OftLimit;
    oftFeeDetails: OftFeeDetail[];
    oftReceipt: OftReceipt;
}> => {
    const createSolanaTokenAccount = await shouldCreateSolanaTokenAccount(
        route.destinationAsset,
        recipient,
    );
    const sendParam = await createOftSendParam(
        route,
        recipient,
        amount,
        oftName,
        buildOftExtraOptions(
            route.destinationAsset,
            nativeDrop,
            createSolanaTokenAccount,
        ),
    );
    const [oftLimit, oftFeeDetails, oftReceipt] = await oft.quoteOFT(sendParam);
    const quotedSendParam: SendParam = [...sendParam];
    quotedSendParam[3] = oftReceipt[1];

    const quotedMsgFee = await oft.quoteSend(quotedSendParam, false);
    const msgFee: MsgFee = [quotedMsgFee[0], quotedMsgFee[1]];

    return {
        sendParam: quotedSendParam,
        msgFee,
        oftLimit,
        oftFeeDetails,
        oftReceipt,
    };
};

export const buildOftApprovalCall = async (
    route: OftRoute,
    owner: string,
    amount: bigint,
    signer: Signer | Wallet,
): Promise<AlchemyCall | undefined> => {
    const oftContract = await createOftContract(route);
    const approvalRequired = await oftContract.approvalRequired?.();
    if (approvalRequired) {
        const { address } = await getOftContract(route);
        const tokenContract = createTokenContract(route.sourceAsset, signer);
        const allowance = await tokenContract.allowance(owner, address);
        if (allowance < amount * 10n) {
            return {
                to: await tokenContract.getAddress(),
                value: undefined,
                data: tokenContract.interface.encodeFunctionData("approve", [
                    address,
                    MaxUint256,
                ]),
            };
        }
    }
    return undefined;
};

export const quoteOftReceiveAmount = async (
    route: OftRoute,
    amount: bigint,
    options: OftQuoteOptions = {},
): Promise<OftReceiveQuote> => {
    if (amount === 0n) {
        return {
            amountIn: 0n,
            amountOut: 0n,
            msgFee: [0n, 0n],
            oftLimit: [0n, 0n],
            oftFeeDetails: [],
            oftReceipt: [0n, 0n],
        };
    }

    const oft = await getQuotedOftContract(route, options.oftName);
    const { msgFee, oftLimit, oftFeeDetails, oftReceipt } = await quoteOftSend(
        oft,
        route,
        options.recipient,
        amount,
        options,
    );

    return {
        amountIn: amount,
        amountOut: oftReceipt[1],
        msgFee,
        oftLimit,
        oftFeeDetails,
        oftReceipt,
    };
};

export const quoteOftAmountInForAmountOut = async (
    route: OftRoute,
    amountOut: bigint,
    options: OftQuoteOptions = {},
): Promise<bigint> => {
    if (amountOut === 0n) {
        return 0n;
    }

    if (
        getBridgeMesh(route.sourceAsset, route.destinationAsset) ===
        Usdt0Kind.Legacy
    ) {
        return getLegacyMeshSourceAmount(amountOut);
    }

    let low = amountOut;
    let high = amountOut;
    let quote = await quoteOftReceiveAmount(route, high, options);

    let attempts = 0;
    while (quote.amountOut < amountOut) {
        low = high + 1n;
        high *= 2n;
        quote = await quoteOftReceiveAmount(route, high, options);
        attempts += 1;

        if (attempts > 32) {
            throw new Error(
                `Could not quote OFT amount for route ${formatRoute(route)}`,
            );
        }
    }

    while (low < high) {
        const mid = low + (high - low) / 2n;
        const midQuote = await quoteOftReceiveAmount(route, mid, options);

        if (midQuote.amountOut >= amountOut) {
            high = mid;
        } else {
            low = mid + 1n;
        }
    }

    return low;
};

export const getSolanaOftTokenBalance = async (
    route: OftRoute,
    ownerAddress: string,
    oftName = defaultOftName,
): Promise<bigint> => {
    const oftContract = await getOftContract(route, oftName);
    const oftStore = await getOftStoreContract(route, oftName);

    return await getSolanaLegacyMeshTokenBalance(
        {
            asset: route.sourceAsset,
            programAddress: oftContract.address,
            storeAddress: oftStore.address,
        },
        ownerAddress,
    );
};

export const getOftTransactionSender = async (
    sourceAsset: string,
    txHash: string,
): Promise<string | undefined> => {
    const transport = getOftTransport(sourceAsset);

    switch (transport) {
        case NetworkTransport.Evm:
            return (await getOftProvider(sourceAsset).getTransaction(txHash))
                ?.from;

        case NetworkTransport.Solana:
            return await getSolanaTransactionSender(sourceAsset, txHash);

        case NetworkTransport.Tron:
            return undefined;

        default: {
            const exhaustiveCheck: never = transport;
            throw new Error(
                `Unhandled OFT transport: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

export const getOftTransactionConfirmationTimestamp = async (
    sourceAsset: string,
    txHash: string,
): Promise<number | undefined> => {
    switch (getOftTransport(sourceAsset)) {
        case NetworkTransport.Evm: {
            const provider = getOftProvider(sourceAsset);
            const tx = await provider.getTransaction(txHash);
            if (tx?.blockNumber === undefined || tx.blockNumber === null) {
                return undefined;
            }
            const block = await provider.getBlock(tx.blockNumber);
            return block?.timestamp;
        }

        case NetworkTransport.Solana: {
            const connection = await getSolanaConnection(sourceAsset);
            const tx = await connection.getParsedTransaction(txHash, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
            });
            return tx?.blockTime ?? undefined;
        }

        case NetworkTransport.Tron:
            return undefined;
    }
};
