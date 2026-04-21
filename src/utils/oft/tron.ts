import type { TronConnector } from "@reown/appkit-utils/tron";
import { Interface } from "ethers";
import type { TronWeb as TronWebClient } from "tronweb";

import { NetworkTransport } from "../../configs/base";
import { getTokenAddress } from "../../consts/Assets";
import {
    type TronSignedTransaction,
    type TronTransactionInfo,
    getTronTransactionInfo,
    getTronWeb,
    isFailedTronTransaction,
    isValidTronAddress,
    tronBase58ToHexAddress,
    tronHexToBase58Address,
} from "../chains/tron";
import { oftAbi } from "./evm";
import type {
    MsgFee,
    OftFeeDetail,
    OftLimit,
    OftReceipt,
    OftSentEvent,
    OftTransaction,
    SendParam,
} from "./types";

const tronSendFeeLimit = 150_000_000n;
const oftInterface = new Interface(oftAbi);
const erc20Interface = new Interface([
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
]);
const quoteOftSelector =
    "quoteOFT((uint32,bytes32,uint256,uint256,bytes,bytes,bytes))";
const quoteSendSelector =
    "quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool)";
const sendSelector =
    "send((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),(uint256,uint256),address)";
const approveSelector = "approve(address,uint256)";

type BroadcastResult = {
    txID: string;
    signature?: string[];
    raw_data_hex?: string;
};

type TronSignTransactionResponse =
    | BroadcastResult
    | {
          result: BroadcastResult;
      };

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

const signTronTransaction = async (
    walletProvider: WalletConnectTronConnector,
    walletAddress: string,
    transaction: unknown,
): Promise<BroadcastResult> => {
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

    if ("txID" in response) {
        return response;
    }

    return response.result;
};

const encodeContractParams = (data: string): string => {
    if (!data.startsWith("0x") || data.length < 10) {
        throw new Error(`Invalid encoded contract call: ${data}`);
    }

    return data.slice(10);
};

const decodeConstantResult = (functionName: string, result: string) =>
    oftInterface.decodeFunctionResult(functionName, `0x${result}`);

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

        let parsedLog;
        try {
            parsedLog = oftInterface.parseLog({
                data: `0x${eventLog.data}`,
                topics: eventLog.topics.map((topic) =>
                    topic.startsWith("0x") ? topic : `0x${topic}`,
                ),
            });
        } catch {
            continue;
        }

        if (parsedLog?.name !== "OFTSent") {
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

    const constantResult = response.constant_result?.[0];
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

const waitForSuccessfulTronTransaction = async (
    sourceAsset: string,
    txHash: string,
) => {
    const transactionInfo = await waitForTronTransactionConfirmation(
        sourceAsset,
        txHash,
    );
    if (isFailedTronTransaction(transactionInfo)) {
        throw new Error(
            transactionInfo.resMessage ?? `Tron transaction ${txHash} failed`,
        );
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
    transaction: unknown;
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
    sourceAsset: string,
    client: TronWebClient,
    signedTransaction: BroadcastResult,
): Promise<OftTransaction> => {
    const transactionHash = signedTransaction.txID;
    if (transactionHash === undefined || transactionHash === "") {
        throw new Error("Tron wallet did not return a transaction ID");
    }

    const broadcast = await client.trx.sendRawTransaction(
        signedTransaction as TronSignedTransaction,
    );
    if (broadcast.result !== true) {
        throw new Error(
            broadcast.message !== undefined
                ? broadcast.message
                : broadcast.code !== undefined
                  ? String(broadcast.code)
                  : `Failed to broadcast Tron transaction ${transactionHash}`,
        );
    }

    return {
        hash: transactionHash,
        wait: async () =>
            await waitForSuccessfulTronTransaction(
                sourceAsset,
                transactionHash,
            ),
    };
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
        erc20Interface.encodeFunctionData("balanceOf", [
            tronBase58ToHexAddress(ownerAddress),
        ]),
        ownerAddress,
    );
    const [balance] = erc20Interface.decodeFunctionResult(
        "balanceOf",
        `0x${result}`,
    ) as unknown as [bigint];

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
        erc20Interface.encodeFunctionData("allowance", [
            tronBase58ToHexAddress(ownerAddress),
            tronBase58ToHexAddress(spenderAddress),
        ]),
        ownerAddress,
    );
    const [allowance] = erc20Interface.decodeFunctionResult(
        "allowance",
        `0x${result}`,
    ) as unknown as [bigint];

    return allowance;
};

export const sendTronTokenApproval = async (params: {
    sourceAsset: string;
    ownerAddress: string;
    spenderAddress: string;
    amount: bigint;
    walletProvider: TronConnector;
}): Promise<OftTransaction> => {
    const tokenAddress = getTokenAddress(params.sourceAsset);
    const { client, transaction } = await buildTronSmartContractTransaction({
        sourceAsset: params.sourceAsset,
        contractAddress: tokenAddress,
        functionSelector: approveSelector,
        encodedCall: erc20Interface.encodeFunctionData("approve", [
            tronBase58ToHexAddress(params.spenderAddress),
            params.amount,
        ]),
        ownerAddress: params.ownerAddress,
        errorContext: "Tron token approval transaction",
    });

    const signedTransaction = await signTronTransaction(
        params.walletProvider as WalletConnectTronConnector,
        params.ownerAddress,
        transaction,
    );

    return await submitSignedTronTransaction(
        params.sourceAsset,
        client,
        signedTransaction,
    );
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
        oftInterface.encodeFunctionData("quoteOFT", [sendParam]),
    );
    const [oftLimit, oftFeeDetails, oftReceipt] = decodeConstantResult(
        "quoteOFT",
        result,
    ) as unknown as [OftLimit, OftFeeDetail[], OftReceipt];

    return [
        [BigInt(oftLimit[0]), BigInt(oftLimit[1])],
        oftFeeDetails.map(([feeAmountLd, description]) => [
            BigInt(feeAmountLd),
            String(description),
        ]),
        [BigInt(oftReceipt[0]), BigInt(oftReceipt[1])],
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
        oftInterface.encodeFunctionData("quoteSend", [sendParam, payInLzToken]),
    );
    const [msgFee] = decodeConstantResult("quoteSend", result) as unknown as [
        MsgFee,
    ];

    return [BigInt(msgFee[0]), BigInt(msgFee[1])] as MsgFee;
};

const getTronOftApprovalRequired = async (
    params: TronOftContractParams,
): Promise<boolean> => {
    const result = await callTronConstantContract(
        params.sourceAsset,
        params.contractAddress,
        "approvalRequired()",
        oftInterface.encodeFunctionData("approvalRequired", []),
    );
    const [approvalRequired] = oftInterface.decodeFunctionResult(
        "approvalRequired",
        `0x${result}`,
    ) as unknown as [boolean];

    return approvalRequired;
};

const sendTronOft = async (params: {
    sourceAsset: string;
    contractAddress: string;
    walletProvider: TronConnector;
    sendParam: SendParam;
    msgFee: MsgFee;
    refundAddress: string;
}): Promise<OftTransaction> => {
    const { client, transaction } = await buildTronSmartContractTransaction({
        sourceAsset: params.sourceAsset,
        contractAddress: params.contractAddress,
        functionSelector: sendSelector,
        encodedCall: oftInterface.encodeFunctionData("send", [
            params.sendParam,
            params.msgFee,
            tronBase58ToHexAddress(params.refundAddress),
        ]),
        ownerAddress: params.refundAddress,
        errorContext: "Tron OFT send transaction",
        callValue: params.msgFee[0],
    });

    const signedTransaction = await signTronTransaction(
        params.walletProvider as WalletConnectTronConnector,
        params.refundAddress,
        transaction,
    );

    return await submitSignedTronTransaction(
        params.sourceAsset,
        client,
        signedTransaction,
    );
};

export const createTronOftContract = (params: CreateTronOftContractParams) => ({
    transport: NetworkTransport.Tron,
    interface: oftInterface,
    quoteOFT: async (sendParam: SendParam) =>
        await quoteTronOft(params, sendParam),
    quoteSend: async (sendParam: SendParam, payInLzToken: boolean) =>
        await quoteTronSend(params, sendParam, payInLzToken),
    approvalRequired: async () => await getTronOftApprovalRequired(params),
    send: async (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
    ): Promise<OftTransaction> => {
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
        });
    },
});
