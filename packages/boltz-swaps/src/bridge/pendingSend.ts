import {
    type Hex,
    type Log,
    type PublicClient,
    decodeEventLog,
    decodeFunctionData,
    getAbiItem,
    getAddress,
} from "viem";

import { tokenMessengerV2Abi } from "../cctp/directSend.ts";
import { cctpMessageSentTopic } from "../cctp/events.ts";
import { cctpEmptyHookData } from "../cctp/evm.ts";
import { getLogger } from "../logger.ts";
import { oftAbi } from "../oft/evm.ts";
import { getSolanaConnection } from "../solana/index.ts";
import {
    getTronTransaction,
    getTronTransactionInfo,
    isFailedTronTransaction,
} from "../tron/index.ts";
import { PendingBridgeSendKind } from "./types.ts";

export type PendingEvmOftBridgeSend = {
    kind: PendingBridgeSendKind.EvmOft;
    createdAt: number;
    sender: string;
    fromNonce: number;
    fromBlock: number;
    oftContractAddress: string;
    transactionTo: string;
    calldata: string;
};

export type PendingEvmCctpBridgeSend = {
    kind: PendingBridgeSendKind.EvmCctp;
    createdAt: number;
    sender: string;
    fromNonce: number;
    fromBlock: number;
    tokenMessenger: string;
    messageTransmitter: string;
    calldata: string;
};

export type PendingEvmBridgeSend =
    | PendingEvmOftBridgeSend
    | PendingEvmCctpBridgeSend;

export type PendingSolanaOftBridgeSend = {
    kind: PendingBridgeSendKind.SolanaOft;
    sourceAsset: string;
    lastValidBlockHeight: number;
    signature: string;
};

export type PendingSolanaCctpBridgeSend = {
    kind: PendingBridgeSendKind.SolanaCctp;
    sourceAsset: string;
    lastValidBlockHeight: number;
    signature: string;
};

export type PendingTronOftBridgeSend = {
    kind: PendingBridgeSendKind.TronOft;
    createdAt: number;
    sourceAsset: string;
    txHash: string;
};

export type PendingBridgeSend =
    | PendingEvmOftBridgeSend
    | PendingEvmCctpBridgeSend
    | PendingSolanaOftBridgeSend
    | PendingSolanaCctpBridgeSend
    | PendingTronOftBridgeSend;

export type PendingBridgeSendCallbacks = {
    persist: (pending: PendingBridgeSend) => Promise<void>;
};

export enum PendingBridgeSendRecoveryStatus {
    Recovered = "recovered",
    Failed = "failed",
    Pending = "pending",
}

export type PendingBridgeSendRecoveryResult =
    | {
          status: PendingBridgeSendRecoveryStatus.Recovered;
          transactionHash: string;
      }
    | { status: PendingBridgeSendRecoveryStatus.Failed }
    | { status: PendingBridgeSendRecoveryStatus.Pending };

const oftSentEvent = getAbiItem({ abi: oftAbi, name: "OFTSent" });
const cctpDepositForBurnEvent = getAbiItem({
    abi: tokenMessengerV2Abi,
    name: "DepositForBurn",
});

const evmSendRecoveryTimeoutMs = 120_000;

const sameEvmString = (left: string | null | undefined, right: string) =>
    left !== null &&
    left !== undefined &&
    left.toLowerCase() === right.toLowerCase();

const decodeCctpPendingSendCalldata = (calldata: string) => {
    const decoded = decodeFunctionData({
        abi: tokenMessengerV2Abi,
        data: calldata as Hex,
    });
    const [
        amount,
        destinationDomain,
        mintRecipient,
        burnToken,
        destinationCaller,
        maxFee,
        minFinalityThreshold,
        hookData = cctpEmptyHookData,
    ] = decoded.args;

    return {
        amount,
        destinationDomain,
        mintRecipient,
        burnToken,
        destinationCaller,
        maxFee,
        minFinalityThreshold,
        hookData,
    };
};

const isOftSentLog = (event: Log, oftContractAddress: string) => {
    if (!sameEvmString(event.address, oftContractAddress)) {
        return false;
    }
    try {
        decodeEventLog({
            abi: oftAbi,
            eventName: "OFTSent",
            data: event.data as Hex,
            topics: event.topics as [Hex, ...Hex[]],
        });
        return true;
    } catch {
        return false;
    }
};

const hasCctpMessageSentLog = (
    logs: ReadonlyArray<Log>,
    messageTransmitter: string,
) =>
    logs.some(
        (entry) =>
            sameEvmString(entry.address, messageTransmitter) &&
            entry.topics[0]?.toLowerCase() === cctpMessageSentTopic,
    );

const isMatchingCctpDepositForBurn = (
    event: Log,
    pendingSend: PendingEvmCctpBridgeSend,
    expected: ReturnType<typeof decodeCctpPendingSendCalldata>,
) => {
    if (!sameEvmString(event.address, pendingSend.tokenMessenger)) {
        return false;
    }

    try {
        const decoded = decodeEventLog({
            abi: tokenMessengerV2Abi,
            eventName: "DepositForBurn",
            data: event.data as Hex,
            topics: event.topics as [Hex, ...Hex[]],
        });
        if (decoded.eventName !== "DepositForBurn") {
            return false;
        }

        const args = decoded.args;
        return (
            sameEvmString(args.burnToken, expected.burnToken) &&
            sameEvmString(args.depositor, pendingSend.sender) &&
            args.amount === expected.amount &&
            args.destinationDomain === expected.destinationDomain &&
            sameEvmString(args.mintRecipient, expected.mintRecipient) &&
            sameEvmString(args.destinationCaller, expected.destinationCaller) &&
            args.maxFee === expected.maxFee &&
            args.minFinalityThreshold === expected.minFinalityThreshold &&
            sameEvmString(args.hookData, expected.hookData)
        );
    } catch {
        return false;
    }
};

const getPendingEvmSendTimeoutResult = async (
    pendingSend: PendingEvmBridgeSend,
    provider: PublicClient,
    label: string,
): Promise<PendingBridgeSendRecoveryResult> => {
    const [latestNonce, pendingNonce] = await Promise.all([
        provider.getTransactionCount({
            address: getAddress(pendingSend.sender),
            blockTag: "latest",
        }),
        provider.getTransactionCount({
            address: getAddress(pendingSend.sender),
            blockTag: "pending",
        }),
    ]);
    const age = Date.now() - pendingSend.createdAt;
    if (age > evmSendRecoveryTimeoutMs) {
        getLogger().warn(`Pending EVM ${label} send recovery timed out`, {
            sender: pendingSend.sender,
            fromNonce: pendingSend.fromNonce,
            fromBlock: pendingSend.fromBlock,
            latestNonce,
            pendingNonce,
        });
        return { status: PendingBridgeSendRecoveryStatus.Failed };
    }

    return { status: PendingBridgeSendRecoveryStatus.Pending };
};

export const recoverPendingEvmOftSend = async (
    pendingSend: PendingEvmOftBridgeSend,
    provider: PublicClient,
): Promise<PendingBridgeSendRecoveryResult> => {
    const log = getLogger();
    const logs = await provider.getLogs({
        address: getAddress(pendingSend.oftContractAddress),
        fromBlock: BigInt(pendingSend.fromBlock),
        toBlock: "latest",
        event: oftSentEvent,
        args: { fromAddress: getAddress(pendingSend.sender) },
    });
    log.info("Checking pending EVM OFT send", {
        sender: pendingSend.sender,
        fromNonce: pendingSend.fromNonce,
        fromBlock: pendingSend.fromBlock,
        logs: logs.length,
    });

    const matches = new Set<string>();
    for (const event of logs) {
        if (event.transactionHash === null) {
            continue;
        }
        const transactionHash = event.transactionHash;
        const [transaction, receipt] = await Promise.all([
            provider.getTransaction({ hash: transactionHash }),
            provider.getTransactionReceipt({ hash: transactionHash }),
        ]);
        if (
            transaction === null ||
            receipt === null ||
            receipt.status !== "success"
        ) {
            continue;
        }
        if (
            transaction.nonce >= pendingSend.fromNonce &&
            sameEvmString(transaction.from, pendingSend.sender) &&
            sameEvmString(transaction.to, pendingSend.transactionTo) &&
            sameEvmString(transaction.input, pendingSend.calldata) &&
            receipt.logs.some((entry) =>
                isOftSentLog(entry, pendingSend.oftContractAddress),
            )
        ) {
            matches.add(transactionHash);
        }
    }
    const matchedTransactionHashes = [...matches];

    if (matchedTransactionHashes.length === 1) {
        log.info("Recovered pending EVM OFT send", {
            sender: pendingSend.sender,
            fromNonce: pendingSend.fromNonce,
            transactionHash: matchedTransactionHashes[0],
        });
        return {
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: matchedTransactionHashes[0],
        };
    }

    if (matchedTransactionHashes.length > 1) {
        log.warn("Found multiple matching pending bridge sends", {
            sender: pendingSend.sender,
            fromNonce: pendingSend.fromNonce,
            matches: matchedTransactionHashes,
        });
        return { status: PendingBridgeSendRecoveryStatus.Pending };
    }

    return await getPendingEvmSendTimeoutResult(pendingSend, provider, "OFT");
};

export const recoverPendingEvmCctpSend = async (
    pendingSend: PendingEvmCctpBridgeSend,
    provider: PublicClient,
): Promise<PendingBridgeSendRecoveryResult> => {
    const log = getLogger();
    const expected = decodeCctpPendingSendCalldata(pendingSend.calldata);
    const logs = await provider.getLogs({
        address: getAddress(pendingSend.tokenMessenger),
        fromBlock: BigInt(pendingSend.fromBlock),
        toBlock: "latest",
        event: cctpDepositForBurnEvent,
        args: {
            burnToken: getAddress(expected.burnToken),
            depositor: getAddress(pendingSend.sender),
            minFinalityThreshold: expected.minFinalityThreshold,
        },
    });
    log.info("Checking pending EVM CCTP send", {
        sender: pendingSend.sender,
        fromNonce: pendingSend.fromNonce,
        fromBlock: pendingSend.fromBlock,
        logs: logs.length,
    });

    const matches = new Set<string>();
    for (const event of logs) {
        if (
            event.transactionHash === null ||
            !isMatchingCctpDepositForBurn(event, pendingSend, expected)
        ) {
            continue;
        }

        const transactionHash = event.transactionHash;
        const [transaction, receipt] = await Promise.all([
            provider.getTransaction({ hash: transactionHash }),
            provider.getTransactionReceipt({ hash: transactionHash }),
        ]);
        if (
            transaction === null ||
            receipt === null ||
            receipt.status !== "success"
        ) {
            continue;
        }

        if (
            transaction.nonce >= pendingSend.fromNonce &&
            sameEvmString(transaction.from, pendingSend.sender) &&
            sameEvmString(transaction.to, pendingSend.tokenMessenger) &&
            sameEvmString(transaction.input, pendingSend.calldata) &&
            hasCctpMessageSentLog(receipt.logs, pendingSend.messageTransmitter)
        ) {
            matches.add(transactionHash);
        }
    }
    const matchedTransactionHashes = [...matches];

    if (matchedTransactionHashes.length === 1) {
        log.info("Recovered pending EVM CCTP send", {
            sender: pendingSend.sender,
            fromNonce: pendingSend.fromNonce,
            transactionHash: matchedTransactionHashes[0],
        });
        return {
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: matchedTransactionHashes[0],
        };
    }

    if (matchedTransactionHashes.length > 1) {
        log.warn("Found multiple matching pending CCTP bridge sends", {
            sender: pendingSend.sender,
            fromNonce: pendingSend.fromNonce,
            matches: matchedTransactionHashes,
        });
        return { status: PendingBridgeSendRecoveryStatus.Pending };
    }

    return await getPendingEvmSendTimeoutResult(pendingSend, provider, "CCTP");
};

const recoverPendingSolanaSend = async (
    pendingSend: PendingSolanaOftBridgeSend | PendingSolanaCctpBridgeSend,
    label: string,
): Promise<PendingBridgeSendRecoveryResult> => {
    const log = getLogger();
    const connection = await getSolanaConnection(pendingSend.sourceAsset);
    const status = (
        await connection.getSignatureStatuses([pendingSend.signature], {
            searchTransactionHistory: true,
        })
    ).value[0];
    if (status !== null) {
        if (status.err !== null) {
            log.warn(`Pending Solana ${label} send failed on-chain`, {
                sourceAsset: pendingSend.sourceAsset,
                signature: pendingSend.signature,
                error: status.err,
            });
            return { status: PendingBridgeSendRecoveryStatus.Failed };
        }

        log.info(`Recovered pending Solana ${label} send`, {
            sourceAsset: pendingSend.sourceAsset,
            signature: pendingSend.signature,
        });
        return {
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: pendingSend.signature,
        };
    }

    const currentBlockHeight = await connection.getBlockHeight("confirmed");
    if (currentBlockHeight > pendingSend.lastValidBlockHeight) {
        log.warn(`Pending Solana ${label} send blockhash expired`, {
            sourceAsset: pendingSend.sourceAsset,
            signature: pendingSend.signature,
            currentBlockHeight,
            lastValidBlockHeight: pendingSend.lastValidBlockHeight,
        });
        return { status: PendingBridgeSendRecoveryStatus.Failed };
    }

    return { status: PendingBridgeSendRecoveryStatus.Pending };
};

export const recoverPendingSolanaOftSend = async (
    pendingSend: PendingSolanaOftBridgeSend,
): Promise<PendingBridgeSendRecoveryResult> =>
    await recoverPendingSolanaSend(pendingSend, "OFT");

export const recoverPendingSolanaCctpSend = async (
    pendingSend: PendingSolanaCctpBridgeSend,
): Promise<PendingBridgeSendRecoveryResult> =>
    await recoverPendingSolanaSend(pendingSend, "CCTP");

export const recoverPendingTronOftSend = async (
    pendingSend: PendingTronOftBridgeSend,
): Promise<PendingBridgeSendRecoveryResult> => {
    const log = getLogger();
    const [transaction, transactionInfo] = await Promise.all([
        getTronTransaction(pendingSend.sourceAsset, pendingSend.txHash),
        getTronTransactionInfo(pendingSend.sourceAsset, pendingSend.txHash),
    ]);

    if (transactionInfo !== undefined) {
        if (
            transactionInfo.result === "FAILED" ||
            (transactionInfo.receipt !== undefined &&
                isFailedTronTransaction(transactionInfo))
        ) {
            log.warn("Pending Tron OFT send failed on-chain", {
                sourceAsset: pendingSend.sourceAsset,
                txHash: pendingSend.txHash,
            });
            return { status: PendingBridgeSendRecoveryStatus.Failed };
        }

        log.info("Recovered pending Tron OFT send from transaction info", {
            sourceAsset: pendingSend.sourceAsset,
            txHash: pendingSend.txHash,
        });
        return {
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: pendingSend.txHash,
        };
    }

    if (transaction !== undefined) {
        log.info("Recovered pending Tron OFT send from transaction", {
            sourceAsset: pendingSend.sourceAsset,
            txHash: pendingSend.txHash,
        });
        return {
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: pendingSend.txHash,
        };
    }

    return { status: PendingBridgeSendRecoveryStatus.Pending };
};

export const recoverPendingBridgeSend = async (
    pendingSend: PendingBridgeSend,
    provider?: PublicClient,
): Promise<PendingBridgeSendRecoveryResult> => {
    switch (pendingSend.kind) {
        case PendingBridgeSendKind.EvmOft:
            if (provider === undefined) {
                throw new Error(
                    "EVM pending bridge send recovery needs an RPC provider",
                );
            }
            return await recoverPendingEvmOftSend(pendingSend, provider);

        case PendingBridgeSendKind.EvmCctp:
            if (provider === undefined) {
                throw new Error(
                    "EVM pending bridge send recovery needs an RPC provider",
                );
            }
            return await recoverPendingEvmCctpSend(pendingSend, provider);

        case PendingBridgeSendKind.SolanaOft:
            return await recoverPendingSolanaOftSend(pendingSend);

        case PendingBridgeSendKind.SolanaCctp:
            return await recoverPendingSolanaCctpSend(pendingSend);

        case PendingBridgeSendKind.TronOft:
            return await recoverPendingTronOftSend(pendingSend);

        default: {
            const exhaustiveCheck: never = pendingSend;
            throw new Error(
                `Unsupported pending bridge send: ${String(exhaustiveCheck)}`,
            );
        }
    }
};
