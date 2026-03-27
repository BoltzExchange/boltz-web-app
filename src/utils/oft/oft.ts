import { hex } from "@scure/base";
import {
    Contract,
    type ContractRunner,
    type Log,
    type TransactionReceipt,
    ZeroAddress,
    concat,
    getBytes,
    solidityPacked,
    zeroPadValue,
} from "ethers";
import log from "loglevel";
import { getUsdt0Mesh } from "src/consts/Assets";

import type { AlchemyCall } from "../../alchemy/Alchemy";
import { config } from "../../config";
import { NetworkTransport, Usdt0Kind } from "../../configs/base";
import type { OftRoute } from "../Pair";
import {
    clearSolanaTokenAccountCreationCache,
    decodeSolanaAddress,
    shouldCreateSolanaTokenAccount,
    solanaAtaRentExemptLamports,
} from "../chains/solana";
import { decodeTronBase58Address } from "../chains/tron";
import {
    type Provider,
    createAssetProvider,
    requireRpcUrls,
} from "../provider";
import {
    type OftContract,
    clearOftRegistry,
    defaultOftName,
    formatRoute,
    getOftChain,
    getPrimaryOftContract,
} from "./registry";

// TODO: review quote methods

const providerCache = new Map<string, Provider>();
const executorNativeAmountExceedsCapSelector = "0x0084ce02";

const oftAbi = [
    "function quoteOFT(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes)) view returns (tuple(uint256,uint256), tuple(int256,string)[], tuple(uint256,uint256))",
    "function quoteSend(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), bool) view returns (tuple(uint256,uint256))",
    "function approvalRequired() view returns (bool)",
    "function send(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), tuple(uint256,uint256), address) payable returns (tuple(bytes32,uint64,tuple(uint256,uint256)), tuple(uint256,uint256))",
    "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)",
    "event OFTReceived(bytes32 indexed guid, uint32 srcEid, address indexed toAddress, uint256 amountReceivedLD)",
] as const;

export type SendParam = [
    number,
    string,
    bigint,
    bigint,
    string,
    string,
    string,
];

export type MsgFee = [bigint, bigint];

export type OftNativeDrop = {
    amount: bigint;
    receiver: string;
};

export type OftQuoteOptions = {
    recipient?: string;
    nativeDrop?: OftNativeDrop;
    oftName?: string;
};

type OftLimit = [bigint, bigint];
type OftFeeDetail = [bigint, string];
type OftReceipt = [bigint, bigint];

export type OftReceiveQuote = {
    amountIn: bigint;
    amountOut: bigint;
    msgFee: MsgFee;
    oftLimit: OftLimit;
    oftFeeDetails: OftFeeDetail[];
    oftReceipt: OftReceipt;
};

type OftEventName = "OFTSent" | "OFTReceived";

export type OftSentEvent = {
    guid: string;
    dstEid: bigint;
    fromAddress: string;
    amountSentLD: bigint;
    amountReceivedLD: bigint;
    logIndex: number;
};

export type OftReceivedEvent = {
    guid: string;
    srcEid: bigint;
    toAddress: string;
    amountReceivedLD: bigint;
    logIndex: number;
};

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

type OftContractInstance = {
    interface: Contract["interface"];
    quoteOFT: {
        staticCall: (
            sendParam: SendParam,
        ) => Promise<[OftLimit, OftFeeDetail[], OftReceipt]>;
    };
    quoteSend: {
        staticCall: (
            sendParam: SendParam,
            payInLzToken: boolean,
        ) => Promise<MsgFee>;
    };
    approvalRequired: () => Promise<boolean>;
    send: (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
        overrides?: {
            value?: bigint;
        },
    ) => Promise<{
        hash: string;
        wait: (confirmations?: number) => Promise<unknown>;
    }>;
};

export const clearOftDeployments = () => {
    clearOftRegistry();
    providerCache.clear();
    clearSolanaTokenAccountCreationCache();
};

const type3Option = 3;
const executorWorkerId = 1;
const optionTypeLzReceive = 1;
const optionTypeNativeDrop = 2;
const hundredPercentBps = 10_000n;
const legacyBridgeFeeBps = 3n;

export const getOftProvider = (sourceAsset: string): Provider => {
    const rpcUrls = requireRpcUrls(sourceAsset);
    const cacheKey = `${sourceAsset}:${rpcUrls.join(",")}`;
    const cached = providerCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const provider = createAssetProvider(sourceAsset);
    providerCache.set(cacheKey, provider);
    log.debug("Created OFT provider", {
        sourceAsset,
        rpcUrlCount: rpcUrls.length,
    });
    return provider;
};

export const getQuotedOftContract = async (
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftContractInstance> => {
    const oftContract = await getOftContract(route, oftName);
    return createOftContract(oftContract.address, getOftProvider(route.from));
};

export const getOftContract = (
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftContract> => getPrimaryOftContract(route, oftName);

export const createOftContract = (
    address: string,
    runner: ContractRunner,
): OftContractInstance =>
    new Contract(address, oftAbi, runner) as unknown as OftContractInstance;

const getOftEventLog = (
    contract: OftContractInstance,
    receipt: Pick<TransactionReceipt, "logs">,
    contractAddress: string,
    eventName: OftEventName,
) => {
    const oftLog = receipt.logs.find((eventLog) => {
        if (eventLog.address.toLowerCase() !== contractAddress.toLowerCase()) {
            return false;
        }

        try {
            const parsedLog = contract.interface.parseLog({
                data: eventLog.data,
                topics: eventLog.topics,
            });
            return parsedLog?.name === eventName;
        } catch {
            return false;
        }
    });

    if (oftLog === undefined) {
        throw new Error(`could not find ${eventName} event`);
    }

    return oftLog;
};

const parseOftReceivedLog = (
    contract: OftContractInstance,
    oftReceivedLog: Log,
) => {
    const parsedOftReceived = contract.interface.parseLog({
        data: oftReceivedLog.data,
        topics: oftReceivedLog.topics,
    });
    if (parsedOftReceived?.name !== "OFTReceived") {
        throw new Error("could not parse OFTReceived event");
    }

    const { guid, srcEid, toAddress, amountReceivedLD } =
        parsedOftReceived.args;

    return {
        guid,
        srcEid,
        toAddress,
        amountReceivedLD,
        logIndex: oftReceivedLog.index,
    };
};

export const getOftSentEvent = (
    contract: OftContractInstance,
    receipt: TransactionReceipt,
    contractAddress: string,
): OftSentEvent => {
    const oftSentLog = getOftEventLog(
        contract,
        receipt,
        contractAddress,
        "OFTSent",
    );
    const parsedOftSent = contract.interface.parseLog({
        data: oftSentLog.data,
        topics: oftSentLog.topics,
    });
    if (parsedOftSent?.name !== "OFTSent") {
        throw new Error("could not parse OFTSent event");
    }

    const { guid, dstEid, fromAddress, amountSentLD, amountReceivedLD } =
        parsedOftSent.args;

    const event = {
        guid,
        dstEid,
        fromAddress,
        amountSentLD,
        amountReceivedLD,
        logIndex: oftSentLog.index,
    };

    log.debug("Parsed OFTSent event", {
        contractAddress,
        guid,
        dstEid: dstEid.toString(),
        fromAddress,
        amountSentLD: amountSentLD.toString(),
        amountReceivedLD: amountReceivedLD.toString(),
        logIndex: oftSentLog.index,
    });

    return event;
};

export const getOftReceivedEvent = (
    contract: OftContractInstance,
    receipt: TransactionReceipt,
    contractAddress: string,
): OftReceivedEvent => {
    const oftReceivedLog = getOftEventLog(
        contract,
        receipt,
        contractAddress,
        "OFTReceived",
    );
    const event = parseOftReceivedLog(contract, oftReceivedLog);

    log.debug("Parsed OFTReceived event", {
        contractAddress,
        guid: event.guid,
        srcEid: event.srcEid.toString(),
        toAddress: event.toAddress,
        amountReceivedLD: event.amountReceivedLD.toString(),
        logIndex: event.logIndex,
    });

    return event;
};

export const getOftSentGuid = (
    contract: OftContractInstance,
    receipt: TransactionReceipt,
    contractAddress: string,
): string => getOftSentEvent(contract, receipt, contractAddress).guid;

export const getOftReceivedGuid = (
    contract: OftContractInstance,
    receipt: TransactionReceipt,
    contractAddress: string,
): string => getOftReceivedEvent(contract, receipt, contractAddress).guid;

export const getOftReceivedEventByGuid = async (
    contract: OftContractInstance,
    provider: Pick<Provider, "getLogs">,
    contractAddress: string,
    guid: string,
): Promise<OftReceivedEvent | undefined> => {
    const [eventTopic, guidTopic] = contract.interface.encodeFilterTopics(
        "OFTReceived",
        [guid],
    );
    const logs = await provider.getLogs({
        address: contractAddress,
        fromBlock: 0,
        toBlock: "latest",
        topics: [eventTopic, guidTopic],
    });
    const receivedLog = logs.find((eventLog) => {
        try {
            const parsedLog = contract.interface.parseLog({
                data: eventLog.data,
                topics: eventLog.topics,
            });
            return parsedLog?.name === "OFTReceived";
        } catch {
            return false;
        }
    });

    if (receivedLog === undefined) {
        return undefined;
    }

    const event = parseOftReceivedLog(contract, receivedLog);
    log.debug("Found OFTReceived event by guid", {
        contractAddress,
        guid: event.guid,
        srcEid: event.srcEid.toString(),
        toAddress: event.toAddress,
        amountReceivedLD: event.amountReceivedLD.toString(),
        logIndex: event.logIndex,
    });

    return event;
};

const newOptions = (): string => solidityPacked(["uint16"], [type3Option]);

const encodeRecipient = (
    transport: NetworkTransport,
    recipient: string,
): string => {
    switch (transport) {
        case NetworkTransport.Evm:
            return zeroPadValue(recipient, 32);

        case NetworkTransport.Solana: {
            return `0x${hex.encode(decodeSolanaAddress(recipient))}`;
        }

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
    return encodeRecipient(
        config.assets?.[asset]?.network?.transport,
        recipient,
    );
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
    nativeDrop: OftNativeDrop | undefined,
    createSolanaTokenAccount: boolean,
): string => {
    let options = "0x";

    if (createSolanaTokenAccount) {
        options = appendExecutorOption(
            options,
            optionTypeLzReceive,
            solidityPacked(
                ["uint128", "uint128"],
                [0n, solanaAtaRentExemptLamports],
            ),
        );
    }

    if (nativeDrop === undefined || nativeDrop.amount <= 0n) {
        return options;
    }

    const option = solidityPacked(
        ["uint128", "bytes32"],
        [nativeDrop.amount, zeroPadValue(nativeDrop.receiver, 32)],
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

const createOftSendParam = async (
    route: OftRoute,
    recipient: string | undefined,
    amount: bigint,
    oftName = defaultOftName,
    extraOptions = "0x",
): Promise<SendParam> => {
    const lzEid = (await getOftChain(route.to, route, oftName))?.lzEid;
    if (lzEid === undefined) {
        throw new Error(
            `Missing LayerZero endpoint id for route ${formatRoute(route)} and OFT ${oftName}`,
        );
    }
    return [
        Number(lzEid),
        encodeOftRecipient(route.to, recipient),
        amount,
        0n,
        extraOptions,
        "0x",
        "0x",
    ];
};

export const quoteOftSend = async (
    oft: OftContractInstance,
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
        route.to,
        recipient,
    );
    const sendParam = await createOftSendParam(
        route,
        recipient,
        amount,
        oftName,
        buildOftExtraOptions(nativeDrop, createSolanaTokenAccount),
    );
    const [oftLimit, oftFeeDetails, oftReceipt] =
        await oft.quoteOFT.staticCall(sendParam);
    const quotedSendParam: SendParam = [...sendParam];
    quotedSendParam[3] = oftReceipt[1];

    const quotedMsgFee = await oft.quoteSend.staticCall(quotedSendParam, false);
    const msgFee: MsgFee = [quotedMsgFee[0], quotedMsgFee[1]];

    return {
        sendParam: quotedSendParam,
        msgFee,
        oftLimit,
        oftFeeDetails,
        oftReceipt,
    };
};

export const buildOftSendAlchemyCall = async ({
    route,
    recipient,
    amount,
    refundAddress,
    oftName = defaultOftName,
}: {
    route: OftRoute;
    recipient: string;
    amount: bigint;
    refundAddress: string;
    oftName?: string;
}): Promise<AlchemyCall> => {
    const oftContract = await getOftContract(route, oftName);
    const quotedOft = await getQuotedOftContract(route, oftName);
    const { sendParam, msgFee } = await quoteOftSend(
        quotedOft,
        route,
        recipient,
        amount,
        { oftName },
    );

    return {
        to: oftContract.address,
        data: quotedOft.interface.encodeFunctionData("send", [
            sendParam,
            msgFee,
            refundAddress,
        ]),
        value: msgFee[0].toString(),
    };
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

    if (getUsdt0Mesh(route.from, route.to) === Usdt0Kind.Legacy) {
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
