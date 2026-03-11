import {
    Contract,
    type ContractRunner,
    JsonRpcProvider,
    ZeroAddress,
    zeroPadValue,
} from "ethers";

import { config } from "../../config";

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
const providerCache = new Map<string, JsonRpcProvider>();

const oftAbi = [
    "function quoteOFT(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes)) view returns (tuple(uint256,uint256), tuple(int256,string)[], tuple(uint256,uint256))",
    "function quoteSend(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), bool) view returns (tuple(uint256,uint256))",
    "function send(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), tuple(uint256,uint256), address) payable returns (tuple(bytes32,uint64,tuple(uint256,uint256)), tuple(uint256,uint256))",
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

type OftLimit = [bigint, bigint];
type OftFeeDetail = [bigint, string];
type OftReceipt = [bigint, bigint];

type OftContractInstance = {
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
};

let oftDeploymentsPromise: Promise<OftRegistry> | undefined;

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

const getOftQuoteProvider = (sourceAsset: string): JsonRpcProvider => {
    const rpcUrl = config.assets?.[sourceAsset]?.network?.rpcUrls[0];
    if (!rpcUrl) {
        throw new Error(`Missing RPC URL for OFT source asset ${sourceAsset}`);
    }

    const cached = providerCache.get(rpcUrl);
    if (cached) {
        return cached;
    }

    const provider = new JsonRpcProvider(rpcUrl);
    providerCache.set(rpcUrl, provider);
    return provider;
};

const getQuotedOftContract = async (
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

    return createOftContract(
        oftContract.address,
        getOftQuoteProvider(sourceAsset),
    );
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

const createOftSendParam = async (
    destinationChainId: number,
    recipient: string,
    amount: bigint,
    oftName = defaultOftName,
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
        "0x",
        "0x",
        "0x",
    ];
};

export const quoteOftSend = async (
    oft: OftContractInstance,
    destinationChainId: number,
    recipient: string,
    amount: bigint,
    oftName = defaultOftName,
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
        oftName,
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
    oftName = defaultOftName,
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

    const oft = await getQuotedOftContract(sourceAsset, oftName);
    const { msgFee, oftLimit, oftFeeDetails, oftReceipt } = await quoteOftSend(
        oft,
        destinationChainId,
        ZeroAddress,
        amount,
        oftName,
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
    oftName = defaultOftName,
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
        oftName,
    );

    let attempts = 0;
    while (quote.amountOut < amountOut) {
        low = high + 1n;
        high *= 2n;
        quote = await quoteOftReceiveAmount(
            sourceAsset,
            destinationChainId,
            high,
            oftName,
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
            oftName,
        );

        if (midQuote.amountOut >= amountOut) {
            high = mid;
        } else {
            low = mid + 1n;
        }
    }

    return low;
};
