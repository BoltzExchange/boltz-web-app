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

import { config } from "../../config";
import {
    type Provider,
    createAssetProvider,
    requireRpcUrls,
} from "../provider";

// TODO: legacy mesh is not supported yet
// TODO: review quote methods

type OftContract = {
    name: string;
    address: string;
    explorer: string;
};

type OftChain = {
    name: string;
    chainId?: number;
    lzEid?: string;
    isSource?: boolean;
    contracts: OftContract[];
};

type OftTokenConfig = {
    native: OftChain[];
    legacyMesh: OftChain[];
};

type OftRegistry = Record<string, OftTokenConfig>;

const oftDeploymentsEndpoint = "https://docs.usdt0.to/api/deployments";
const defaultOftName = "usdt0";
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

let oftDeploymentsPromise: Promise<OftRegistry> | undefined;

const type3Option = 3;
const executorWorkerId = 1;
const optionTypeNativeDrop = 2;

const fetchOftDeployments = async (): Promise<OftRegistry> => {
    const response = await fetch(oftDeploymentsEndpoint);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch OFT deployments: ${response.status} ${response.statusText}`,
        );
    }

    const data: unknown = await response.json();
    return data as OftRegistry;
};

const getOftDeployments = (): Promise<OftRegistry> => {
    if (!oftDeploymentsPromise) {
        oftDeploymentsPromise = fetchOftDeployments();
    }

    return oftDeploymentsPromise;
};

const getOftChains = (tokenConfig?: OftTokenConfig): OftChain[] => {
    if (!tokenConfig) {
        return [];
    }

    return tokenConfig.native;
};

const getOftChain = async (
    chainId: number,
    oftName = defaultOftName,
): Promise<OftChain | undefined> => {
    const deployments = await getOftDeployments();
    const tokenConfig = deployments[oftName.toLowerCase()];

    return getOftChains(tokenConfig).find((chain) => chain.chainId === chainId);
};

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
    sourceAsset: string,
    oftName = defaultOftName,
): Promise<OftContractInstance> => {
    const sourceChainId = config.assets?.[sourceAsset]?.network?.chainId;
    if (!sourceChainId) {
        throw new Error(`Missing OFT source chain id for asset ${sourceAsset}`);
    }

    const oftContract = await getOftContract(sourceChainId, oftName);
    if (!oftContract) {
        throw new Error(
            `Missing OFT contract for chain ${sourceChainId} and OFT ${oftName}`,
        );
    }

    return createOftContract(oftContract.address, getOftProvider(sourceAsset));
};

export const getOftLzEid = async (
    chainId: number,
    oftName = defaultOftName,
): Promise<string | undefined> => {
    const chain = await getOftChain(chainId, oftName);
    return chain?.lzEid;
};

export const getOftContract = async (
    chainId: number,
    oftName = defaultOftName,
): Promise<OftContract | undefined> => {
    const chain = await getOftChain(chainId, oftName);

    return chain?.contracts.find((contract) => contract.name === "OFT");
};

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

const buildOftExtraOptions = (nativeDrop?: OftNativeDrop): string => {
    if (nativeDrop === undefined || nativeDrop.amount <= 0n) {
        return "0x";
    }

    const option = solidityPacked(
        ["uint128", "bytes32"],
        [nativeDrop.amount, zeroPadValue(nativeDrop.receiver, 32)],
    );

    return addExecutorOption(newOptions(), optionTypeNativeDrop, option);
};

const createOftSendParam = async (
    destinationChainId: number,
    recipient: string,
    amount: bigint,
    {
        oftName = defaultOftName,
        extraOptions = "0x",
    }: {
        oftName?: string;
        extraOptions?: string;
    } = {},
): Promise<SendParam> => {
    const lzEid = await getOftLzEid(destinationChainId, oftName);
    if (!lzEid) {
        throw new Error(
            `Missing LayerZero endpoint id for chain ${destinationChainId} and OFT ${oftName}`,
        );
    }

    return [
        Number(lzEid),
        zeroPadValue(recipient, 32),
        amount,
        0n,
        extraOptions,
        "0x",
        "0x",
    ];
};

export const quoteOftSend = async (
    oft: OftContractInstance,
    destinationChainId: number,
    recipient: string,
    amount: bigint,
    { oftName = defaultOftName, nativeDrop }: OftQuoteOptions = {},
): Promise<{
    sendParam: SendParam;
    msgFee: MsgFee;
    oftLimit: OftLimit;
    oftFeeDetails: OftFeeDetail[];
    oftReceipt: OftReceipt;
}> => {
    const sendParam = await createOftSendParam(
        destinationChainId,
        recipient,
        amount,
        {
            oftName,
            extraOptions: buildOftExtraOptions(nativeDrop),
        },
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

export const quoteOftReceiveAmount = async (
    sourceAsset: string,
    destinationChainId: number,
    amount: bigint,
    options: OftQuoteOptions = {},
): Promise<{
    amountIn: bigint;
    amountOut: bigint;
    msgFee: MsgFee;
    oftLimit: OftLimit;
    oftFeeDetails: OftFeeDetail[];
    oftReceipt: OftReceipt;
}> => {
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

    const oft = await getQuotedOftContract(sourceAsset, options.oftName);
    const { msgFee, oftLimit, oftFeeDetails, oftReceipt } = await quoteOftSend(
        oft,
        destinationChainId,
        options.recipient ?? ZeroAddress,
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
    sourceAsset: string,
    destinationChainId: number,
    amountOut: bigint,
    options: OftQuoteOptions = {},
): Promise<bigint> => {
    if (amountOut === 0n) {
        return 0n;
    }

    let low = amountOut;
    let high = amountOut;
    let quote = await quoteOftReceiveAmount(
        sourceAsset,
        destinationChainId,
        high,
        options,
    );

    let attempts = 0;
    while (quote.amountOut < amountOut) {
        low = high + 1n;
        high *= 2n;
        quote = await quoteOftReceiveAmount(
            sourceAsset,
            destinationChainId,
            high,
            options,
        );
        attempts += 1;

        if (attempts > 32) {
            throw new Error(
                `Could not quote OFT amount for ${sourceAsset} to ${destinationChainId}`,
            );
        }
    }

    while (low < high) {
        const mid = low + (high - low) / 2n;
        const midQuote = await quoteOftReceiveAmount(
            sourceAsset,
            destinationChainId,
            mid,
            options,
        );

        if (midQuote.amountOut >= amountOut) {
            high = mid;
        } else {
            low = mid + 1n;
        }
    }

    return low;
};
