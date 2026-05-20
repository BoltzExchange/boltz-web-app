import type { TronConnector } from "@reown/appkit-utils/tron";
import type { Adapter as AbstractTronWalletAdapter } from "@tronweb3/tronwallet-abstract-adapter";
import type { Types as TronTypes, TronWeb as TronWebClient } from "tronweb";
import {
    type ContractFunctionArgs,
    type DecodeEventLogReturnType,
    type Hex,
    decodeEventLog,
    decodeFunctionResult,
    encodeFunctionData,
    maxUint256,
} from "viem";

import type { PendingTronOftBridgeSend } from "../bridge/pendingSend.ts";
import { PendingBridgeSendKind } from "../bridge/types.ts";
import { getTokenAddress } from "../config.ts";
import { prefix0x } from "../evm/prefix0x.ts";
import { erc20Abi } from "../generated/evm-abis.ts";
import { getLogger } from "../logger.ts";
import {
    type TronSignedTransaction,
    type TronTransactionInfo,
    getTronTransactionInfo,
    getTronWeb,
    isFailedTronTransaction,
    isValidTronAddress,
    tronBase58ToHexAddress,
    tronHexToBase58Address,
} from "../tron/index.ts";
import { type BridgeTransaction, NetworkTransport } from "../types.ts";
import { oftAbi } from "./evm.ts";
import type {
    MsgFee,
    OftFeeDetail,
    OftLimit,
    OftReceipt,
    OftSendOverrides,
    OftSentEvent,
    PendingBridgeSendCallbacks,
    SendParam,
} from "./types.ts";

const tronSendFeeLimit = 150_000_000n;
const quoteOftSelector =
    "quoteOFT((uint32,bytes32,uint256,uint256,bytes,bytes,bytes))";
const quoteSendSelector =
    "quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool)";
const sendSelector =
    "send((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),(uint256,uint256),address)";
const approveSelector = "approve(address,uint256)";
const hexPattern = /^[0-9a-f]+$/i;

type TronSignTransactionResponse =
    | TronSignedTransaction
    | {
          result: TronSignedTransaction;
      };

type TronOftSendParam = ContractFunctionArgs<
    typeof oftAbi,
    "view",
    "quoteOFT"
>[0];

type TronOftMsgFee = ContractFunctionArgs<typeof oftAbi, "payable", "send">[1];

type TronOftSentLog = DecodeEventLogReturnType<
    typeof oftAbi,
    "OFTSent",
    Hex[],
    Hex
>;

// The `TronConnector` type doesn't have the `tron_signTransaction` rpc method,
// so we have to extend it here.
// https://docs.reown.com/advanced/multichain/rpc-reference/tron-rpc#tron_signtransaction
type WalletConnectTronConnector = TronConnector & {
    provider: {
        request: <T>(
            request: {
                method: string;
                params: Record<string, unknown>;
            },
            chainId: string,
        ) => Promise<T>;
    };
};

const getTronAddressHexBody = (address: string): string =>
    (isValidTronAddress(address) ? tronBase58ToHexAddress(address) : address)
        .toLowerCase()
        .replace(/^0x/, "")
        .replace(/^41/, "");

const decodeHexToUtf8 = (message: string): string => {
    const hexMessage = message.replace(/^0x/i, "");
    if (
        hexMessage.length === 0 ||
        hexMessage.length % 2 !== 0 ||
        !hexPattern.test(hexMessage)
    ) {
        return message;
    }

    try {
        return decodeURIComponent(hexMessage.replace(/../g, "%$&"));
    } catch {
        return message;
    }
};

const normalizeTronSignedTransaction = (
    response: TronSignTransactionResponse,
): TronSignedTransaction => {
    if ("result" in response) {
        return response.result;
    }
    return response;
};

const getTronTransactionHash = (transaction: TronSignedTransaction): string => {
    const txId = transaction.txID;
    if (typeof txId !== "string" || txId === "") {
        throw new Error("Tron transaction does not include a transaction ID");
    }
    return txId;
};

const signTronTransaction = async (
    walletProvider: WalletConnectTronConnector,
    walletAddress: string,
    transaction: TronTypes.Transaction,
): Promise<TronSignedTransaction> => {
    if (walletProvider.type === "INJECTED" && "adapter" in walletProvider) {
        const adapter = walletProvider.adapter as AbstractTronWalletAdapter;
        const response = await adapter.signTransaction(transaction);
        return normalizeTronSignedTransaction(response);
    }

    const chainId = walletProvider.chains.find((chain) =>
        chain.caipNetworkId.startsWith("tron"),
    )?.caipNetworkId;
    if (chainId === undefined) {
        throw new Error("Tron chain not found");
    }
    const response =
        await walletProvider.provider.request<TronSignTransactionResponse>(
            {
                method: "tron_signTransaction",
                params: {
                    address: walletAddress,
                    transaction: {
                        transaction,
                    },
                },
            },
            chainId,
        );

    return normalizeTronSignedTransaction(response);
};

const encodeContractParams = (data: string): string => {
    if (!data.startsWith("0x") || data.length < 10) {
        throw new Error(`Invalid encoded contract call: ${data}`);
    }

    return data.slice(10);
};

const toTronOftSendParam = (sendParam: SendParam): TronOftSendParam => ({
    dstEid: sendParam[0],
    to: prefix0x(sendParam[1]),
    amountLD: sendParam[2],
    minAmountLD: sendParam[3],
    extraOptions: prefix0x(sendParam[4]),
    composeMsg: prefix0x(sendParam[5]),
    oftCmd: prefix0x(sendParam[6]),
});

const toTronOftMsgFee = (msgFee: MsgFee): TronOftMsgFee => ({
    nativeFee: msgFee[0],
    lzTokenFee: msgFee[1],
});

const getTronLogTopics = (topics: readonly string[]): [Hex, ...Hex[]] => {
    const [signature, ...args] = topics.map(prefix0x);
    if (signature === undefined) {
        throw new Error("Missing Tron event signature topic");
    }
    return [signature, ...args];
};

const decodeTronOftSentLog = (eventLog: {
    data: string;
    topics: readonly string[];
}): TronOftSentLog =>
    decodeEventLog({
        abi: oftAbi,
        eventName: "OFTSent",
        data: prefix0x(eventLog.data),
        topics: getTronLogTopics(eventLog.topics),
    });

const decodeTronOftSentEvent = (
    transactionInfo: Pick<TronTransactionInfo, "log">,
    contractAddress: string,
): OftSentEvent | undefined => {
    const expectedContractAddress = getTronAddressHexBody(contractAddress);

    for (const [logIndex, eventLog] of (transactionInfo.log ?? []).entries()) {
        const logAddress = getTronAddressHexBody(eventLog.address);

        if (logAddress !== expectedContractAddress) {
            continue;
        }

        const parsedLog = (() => {
            try {
                return decodeTronOftSentLog(eventLog);
            } catch {
                return undefined;
            }
        })();
        if (parsedLog === undefined) {
            continue;
        }

        const { guid, dstEid, fromAddress, amountSentLD, amountReceivedLD } =
            parsedLog.args;

        return {
            guid,
            dstEid,
            fromAddress: tronHexToBase58Address(fromAddress),
            amountSentLD,
            amountReceivedLD,
            logIndex,
        };
    }

    return undefined;
};

const callTronConstantContract = async (
    sourceAsset: string,
    contractAddress: string,
    functionSelector: string,
    encodedCall: string,
    ownerAddress: string = contractAddress,
) => {
    const client = await getTronWeb(sourceAsset);
    const response = await client.transactionBuilder.triggerConstantContract(
        contractAddress,
        functionSelector,
        {
            feeLimit: Number(tronSendFeeLimit),
            rawParameter: encodeContractParams(encodedCall),
        },
        [],
        ownerAddress,
    );

    if (response.Error !== undefined || response.result?.result !== true) {
        throw new Error(
            response.result?.message ??
                response.Error ??
                `Failed to call Tron contract ${functionSelector}`,
        );
    }

    const constantResult = (
        response.constant_result as unknown[] | undefined
    )?.[0];
    if (typeof constantResult !== "string") {
        throw new Error(
            `Missing constant result for Tron contract call ${functionSelector}`,
        );
    }

    return constantResult;
};

const waitForTronTransactionConfirmation = async (
    sourceAsset: string,
    txHash: string,
) => {
    while (true) {
        const transactionInfo = await getTronTransactionInfo(
            sourceAsset,
            txHash,
        );
        if (transactionInfo !== undefined) {
            return transactionInfo;
        }

        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
};

export const waitForSuccessfulTronTransaction = async (
    sourceAsset: string,
    txHash: string,
) => {
    const transactionInfo = await waitForTronTransactionConfirmation(
        sourceAsset,
        txHash,
    );
    if (isFailedTronTransaction(transactionInfo)) {
        const failureMessage =
            transactionInfo.resMessage !== undefined
                ? decodeHexToUtf8(transactionInfo.resMessage)
                : `Tron transaction ${txHash} failed`;

        throw new Error(failureMessage);
    }

    return transactionInfo;
};

const buildTronSmartContractTransaction = async (params: {
    sourceAsset: string;
    contractAddress: string;
    functionSelector: string;
    encodedCall: string;
    ownerAddress: string;
    errorContext: string;
    callValue?: bigint;
}): Promise<{
    client: TronWebClient;
    transaction: TronTypes.Transaction;
}> => {
    const client = await getTronWeb(params.sourceAsset);
    const options: Record<string, number | string> = {
        feeLimit: Number(tronSendFeeLimit),
        rawParameter: encodeContractParams(params.encodedCall),
    };
    if (params.callValue !== undefined) {
        options.callValue = Number(params.callValue);
    }

    const response = await client.transactionBuilder.triggerSmartContract(
        params.contractAddress,
        params.functionSelector,
        options,
        [],
        params.ownerAddress,
    );

    if (
        response.Error !== undefined ||
        response.result?.result !== true ||
        response.transaction === undefined
    ) {
        throw new Error(
            response.result?.message ??
                response.Error ??
                `Failed to build ${params.errorContext} for ${params.sourceAsset}`,
        );
    }

    return {
        client,
        transaction: response.transaction,
    };
};

const submitSignedTronTransaction = async (
    client: TronWebClient,
    signedTransaction: TronSignedTransaction,
): Promise<BridgeTransaction> => {
    const transactionHash = getTronTransactionHash(signedTransaction);

    const broadcast = await client.trx.sendRawTransaction(signedTransaction);
    if (broadcast.result !== true) {
        throw new Error(
            broadcast.message !== undefined
                ? broadcast.message
                : broadcast.code !== undefined
                  ? String(broadcast.code)
                  : `Failed to broadcast Tron transaction ${transactionHash}`,
        );
    }

    return { hash: transactionHash };
};

export const getTronOftGuidFromTransactionInfo = (
    transactionInfo: Pick<TronTransactionInfo, "log">,
    contractAddress: string,
): string | undefined =>
    decodeTronOftSentEvent(transactionInfo, contractAddress)?.guid;

export const getTronTokenBalance = async (
    route: { sourceAsset: string },
    ownerAddress: string,
): Promise<bigint> => {
    const tokenAddress = getTokenAddress(route.sourceAsset);
    const result = await callTronConstantContract(
        route.sourceAsset,
        tokenAddress,
        "balanceOf(address)",
        encodeFunctionData({
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [tronBase58ToHexAddress(ownerAddress)],
        }),
        ownerAddress,
    );
    const balance = decodeFunctionResult({
        abi: erc20Abi,
        functionName: "balanceOf",
        data: prefix0x(result),
    });

    return balance;
};

export const getTronTokenAllowance = async (
    sourceAsset: string,
    ownerAddress: string,
    spenderAddress: string,
): Promise<bigint> => {
    const tokenAddress = getTokenAddress(sourceAsset);
    const result = await callTronConstantContract(
        sourceAsset,
        tokenAddress,
        "allowance(address,address)",
        encodeFunctionData({
            abi: erc20Abi,
            functionName: "allowance",
            args: [
                tronBase58ToHexAddress(ownerAddress),
                tronBase58ToHexAddress(spenderAddress),
            ],
        }),
        ownerAddress,
    );
    const allowance = decodeFunctionResult({
        abi: erc20Abi,
        functionName: "allowance",
        data: prefix0x(result),
    });

    return allowance;
};

export const sendTronTokenApproval = async (params: {
    sourceAsset: string;
    ownerAddress: string;
    spenderAddress: string;
    walletProvider: TronConnector;
}): Promise<BridgeTransaction> => {
    const tokenAddress = getTokenAddress(params.sourceAsset);
    const { client, transaction } = await buildTronSmartContractTransaction({
        sourceAsset: params.sourceAsset,
        contractAddress: tokenAddress,
        functionSelector: approveSelector,
        encodedCall: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [tronBase58ToHexAddress(params.spenderAddress), maxUint256],
        }),
        ownerAddress: params.ownerAddress,
        errorContext: "Tron token approval transaction",
    });

    const signedTransaction = await signTronTransaction(
        params.walletProvider as WalletConnectTronConnector,
        params.ownerAddress,
        transaction,
    );

    return await submitSignedTronTransaction(client, signedTransaction);
};

type TronOftContractParams = {
    sourceAsset: string;
    contractAddress: string;
};

type CreateTronOftContractParams = TronOftContractParams & {
    walletProvider?: TronConnector;
};

const quoteTronOft = async (
    params: TronOftContractParams,
    sendParam: SendParam,
): Promise<[OftLimit, OftFeeDetail[], OftReceipt]> => {
    const result = await callTronConstantContract(
        params.sourceAsset,
        params.contractAddress,
        quoteOftSelector,
        encodeFunctionData({
            abi: oftAbi,
            functionName: "quoteOFT",
            args: [toTronOftSendParam(sendParam)],
        }),
    );
    const [oftLimit, oftFeeDetails, oftReceipt] = decodeFunctionResult({
        abi: oftAbi,
        functionName: "quoteOFT",
        data: prefix0x(result),
    });

    return [
        [BigInt(oftLimit.minAmountLD), BigInt(oftLimit.maxAmountLD)],
        oftFeeDetails.map(({ feeAmountLD, description }) => [
            BigInt(feeAmountLD),
            String(description),
        ]),
        [BigInt(oftReceipt.amountSentLD), BigInt(oftReceipt.amountReceivedLD)],
    ] as [OftLimit, OftFeeDetail[], OftReceipt];
};

const quoteTronSend = async (
    params: TronOftContractParams,
    sendParam: SendParam,
    payInLzToken: boolean,
): Promise<MsgFee> => {
    const result = await callTronConstantContract(
        params.sourceAsset,
        params.contractAddress,
        quoteSendSelector,
        encodeFunctionData({
            abi: oftAbi,
            functionName: "quoteSend",
            args: [toTronOftSendParam(sendParam), payInLzToken],
        }),
    );
    const msgFee = decodeFunctionResult({
        abi: oftAbi,
        functionName: "quoteSend",
        data: prefix0x(result),
    });

    return [BigInt(msgFee.nativeFee), BigInt(msgFee.lzTokenFee)] as MsgFee;
};

const getTronOftApprovalRequired = async (
    params: TronOftContractParams,
): Promise<boolean> => {
    const result = await callTronConstantContract(
        params.sourceAsset,
        params.contractAddress,
        "approvalRequired()",
        encodeFunctionData({
            abi: oftAbi,
            functionName: "approvalRequired",
            args: [],
        }),
    );
    return decodeFunctionResult({
        abi: oftAbi,
        functionName: "approvalRequired",
        data: prefix0x(result),
    }) as boolean;
};

const sendTronOft = async (params: {
    sourceAsset: string;
    contractAddress: string;
    walletProvider: TronConnector;
    sendParam: SendParam;
    msgFee: MsgFee;
    refundAddress: string;
    pendingSendCallbacks?: PendingBridgeSendCallbacks;
}): Promise<BridgeTransaction> => {
    const { client, transaction } = await buildTronSmartContractTransaction({
        sourceAsset: params.sourceAsset,
        contractAddress: params.contractAddress,
        functionSelector: sendSelector,
        encodedCall: encodeFunctionData({
            abi: oftAbi,
            functionName: "send",
            args: [
                toTronOftSendParam(params.sendParam),
                toTronOftMsgFee(params.msgFee),
                tronBase58ToHexAddress(params.refundAddress),
            ],
        }),
        ownerAddress: params.refundAddress,
        errorContext: "Tron OFT send transaction",
        callValue: params.msgFee[0],
    });
    const signedTransaction = await signTronTransaction(
        params.walletProvider as WalletConnectTronConnector,
        params.refundAddress,
        transaction,
    );
    const transactionHash = getTronTransactionHash(signedTransaction);

    const log = getLogger();
    log.info("Broadcasting pending Tron OFT send...", {
        sourceAsset: params.sourceAsset,
        sender: params.refundAddress,
        txHash: transactionHash,
    });
    const sentTransaction = await submitSignedTronTransaction(
        client,
        signedTransaction,
    );

    const txToPersist: PendingTronOftBridgeSend = {
        kind: PendingBridgeSendKind.TronOft,
        createdAt: Date.now(),
        sourceAsset: params.sourceAsset,
        txHash: sentTransaction.hash,
    };
    await params.pendingSendCallbacks?.persist(txToPersist);
    log.info("Persisted pending Tron OFT send", txToPersist);

    return sentTransaction;
};

export const createTronOftContract = (params: CreateTronOftContractParams) => ({
    transport: NetworkTransport.Tron,
    abi: oftAbi,
    quoteOFT: async (sendParam: SendParam) =>
        await quoteTronOft(params, sendParam),
    quoteSend: async (sendParam: SendParam, payInLzToken: boolean) =>
        await quoteTronSend(params, sendParam, payInLzToken),
    approvalRequired: async () => await getTronOftApprovalRequired(params),
    send: async (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
        overrides?: OftSendOverrides,
    ): Promise<BridgeTransaction> => {
        if (params.walletProvider === undefined) {
            throw new Error(
                `Missing connected Tron wallet for OFT send from ${params.sourceAsset}`,
            );
        }

        return await sendTronOft({
            sourceAsset: params.sourceAsset,
            contractAddress: params.contractAddress,
            walletProvider: params.walletProvider,
            sendParam,
            msgFee,
            refundAddress,
            pendingSendCallbacks: overrides?.pendingSendCallbacks,
        });
    },
});
