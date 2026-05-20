import {
    type Hex,
    type Log,
    type PublicClient,
    decodeEventLog,
    getAbiItem,
    getAddress,
} from "viem";

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

export type PendingSolanaOftBridgeSend = {
    kind: PendingBridgeSendKind.SolanaOft;
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
    | PendingSolanaOftBridgeSend
    | PendingTronOftBridgeSend;

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

// Logs may take a few seconds to be indexed after a transaction is mined, so we
// keep checking briefly even after the sender's nonce has advanced past the
// latest confirmed nonce captured before the pending send.
const minedNonceLogIndexGracePeriodMs = 60_000;
const pendingEvmSendGracePeriodMs = 10 * 60_000;

const sameAddress = (left: string | null | undefined, right: string) =>
    left !== null &&
    left !== undefined &&
    left.toLowerCase() === right.toLowerCase();

const sameHex = (left: string | null | undefined, right: string) =>
    left !== null &&
    left !== undefined &&
    left.toLowerCase() === right.toLowerCase();

const isOftSentLog = (event: Log, oftContractAddress: string) => {
    if (event.address.toLowerCase() !== oftContractAddress.toLowerCase()) {
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
            sameAddress(transaction.from, pendingSend.sender) &&
            sameAddress(transaction.to, pendingSend.transactionTo) &&
            sameHex(transaction.input, pendingSend.calldata) &&
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
    if (
        latestNonce > pendingSend.fromNonce &&
        age > minedNonceLogIndexGracePeriodMs
    ) {
        log.warn("Pending EVM OFT send failed to recover", {
            sender: pendingSend.sender,
            fromNonce: pendingSend.fromNonce,
            latestNonce,
        });
        return { status: PendingBridgeSendRecoveryStatus.Failed };
    }

    if (
        pendingNonce <= pendingSend.fromNonce &&
        age > pendingEvmSendGracePeriodMs
    ) {
        log.warn("Pending EVM OFT send expired without nonce advancement", {
            sender: pendingSend.sender,
            fromNonce: pendingSend.fromNonce,
            latestNonce,
            pendingNonce,
        });
        return { status: PendingBridgeSendRecoveryStatus.Failed };
    }

    return { status: PendingBridgeSendRecoveryStatus.Pending };
};

export const recoverPendingSolanaOftSend = async (
    pendingSend: PendingSolanaOftBridgeSend,
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
            log.warn("Pending Solana OFT send failed on-chain", {
                sourceAsset: pendingSend.sourceAsset,
                signature: pendingSend.signature,
                error: status.err,
            });
            return { status: PendingBridgeSendRecoveryStatus.Failed };
        }

        log.info("Recovered pending Solana OFT send", {
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
        log.warn("Pending Solana OFT send blockhash expired", {
            sourceAsset: pendingSend.sourceAsset,
            signature: pendingSend.signature,
            currentBlockHeight,
            lastValidBlockHeight: pendingSend.lastValidBlockHeight,
        });
        return { status: PendingBridgeSendRecoveryStatus.Failed };
    }

    return { status: PendingBridgeSendRecoveryStatus.Pending };
};

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

        case PendingBridgeSendKind.SolanaOft:
            return await recoverPendingSolanaOftSend(pendingSend);

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
