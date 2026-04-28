import { id } from "ethers";

// keccak256("MessageSent(bytes)") — event on `MessageTransmitterV2` emitted
// once per `depositForBurn*` call.
export const cctpMessageSentTopic = id("MessageSent(bytes)");

// keccak256("MintAndWithdraw(address,uint256,address,uint256)") — event on
// `TokenMinterV2` emitted by a destination mint. `mintRecipient` and
// `mintToken` are indexed; `amount` and `feeCollected` are in data.
export const cctpMintAndWithdrawTopic = id(
    "MintAndWithdraw(address,uint256,address,uint256)",
);

// CCTP v2 outer message header byte offsets (see Circle's MessageV2.sol).
const sourceDomainOffset = 4; // uint32
const destinationDomainOffset = 8; // uint32
const nonceOffset = 12; // bytes32
const senderOffset = 44; // bytes32 (after 12-byte header + 32-byte nonce)
const recipientOffset = 76; // bytes32
const destinationCallerOffset = 108; // bytes32
const bodyOffset = 148; // messageBody starts here

// BurnMessageV2 offsets (within messageBody).
const burnAmountBodyOffset = 68; // uint256 after version(4) + burnToken(32) + mintRecipient(32)
const burnMintRecipientBodyOffset = 36; // bytes32 after version(4) + burnToken(32)
const burnFeeExecutedBodyOffset = 164; // uint256 after maxFee

type LogLike = {
    topics: ReadonlyArray<string>;
    data: string;
    index?: number;
};

const stripPrefix = (value: string): string =>
    value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;

// Extract `bytes` payload from a non-indexed `MessageSent(bytes)` log. The
// data is ABI-encoded (bytes, offset, length, content) — the raw message
// sits at offset 64 with a length prefix.
const decodeMessageBytes = (data: string): string => {
    const hex = stripPrefix(data);
    // hex layout: [32 bytes offset][32 bytes length][message bytes padded to 32]
    const lengthHex = hex.slice(64, 128);
    const messageLengthBytes = Number.parseInt(lengthHex, 16);
    if (!Number.isFinite(messageLengthBytes) || messageLengthBytes <= 0) {
        throw new Error("invalid MessageSent payload length");
    }
    const messageHexLength = messageLengthBytes * 2;
    const messageHex = hex.slice(128, 128 + messageHexLength);
    return `0x${messageHex}`;
};

const readUint32 = (message: string, byteOffset: number): number => {
    const hex = stripPrefix(message);
    const slice = hex.slice(byteOffset * 2, byteOffset * 2 + 8);
    return Number.parseInt(slice, 16);
};

const readBytes32 = (message: string, byteOffset: number): string => {
    const hex = stripPrefix(message);
    return `0x${hex.slice(byteOffset * 2, byteOffset * 2 + 64)}`;
};

const readUint256 = (data: string, byteOffset: number): bigint => {
    const hex = stripPrefix(data);
    return BigInt(`0x${hex.slice(byteOffset * 2, byteOffset * 2 + 64)}`);
};

export type CctpMessageSentInfo = {
    // Unwrapped message bytes (useful for parsing burn-body fields).
    message: string;
    sourceDomain: number;
    destinationDomain: number;
    nonce: string; // bytes32
    sender: string; // bytes32
    recipient: string; // bytes32
    destinationCaller: string; // bytes32
    // Burn amount extracted from the inner BurnMessage body.
    amountSent: bigint;
    logIndex: number;
};

export type CctpBurnMessageInfo = {
    sourceDomain: number;
    destinationDomain: number;
    nonce: string; // bytes32
    sender: string; // bytes32
    recipient: string; // bytes32
    destinationCaller: string; // bytes32
    mintRecipient: string; // bytes32
    amount: bigint;
    feeExecuted: bigint;
    amountReceived: bigint;
};

export const parseCctpBurnMessage = (message: string): CctpBurnMessageInfo => {
    const amount = readUint256(message, bodyOffset + burnAmountBodyOffset);
    const feeExecuted = readUint256(
        message,
        bodyOffset + burnFeeExecutedBodyOffset,
    );
    if (feeExecuted > amount) {
        throw new Error("CCTP feeExecuted exceeds burn amount");
    }

    return {
        sourceDomain: readUint32(message, sourceDomainOffset),
        destinationDomain: readUint32(message, destinationDomainOffset),
        nonce: readBytes32(message, nonceOffset),
        sender: readBytes32(message, senderOffset),
        recipient: readBytes32(message, recipientOffset),
        destinationCaller: readBytes32(message, destinationCallerOffset),
        mintRecipient: readBytes32(
            message,
            bodyOffset + burnMintRecipientBodyOffset,
        ),
        amount,
        feeExecuted,
        amountReceived: amount - feeExecuted,
    };
};

// Locates the single `MessageSent` log in a depositForBurn receipt and pulls
// out everything needed to build a BridgeSentEvent. Circle's Iris API indexes
// messages by source-chain transaction hash, so callers can re-query the
// attestation service using `receipt.hash` rather than recomputing a
// message-level identifier here.
export const parseCctpMessageSent = (receipt: {
    logs: ReadonlyArray<LogLike>;
}): CctpMessageSentInfo | undefined => {
    const log = receipt.logs.find(
        (entry) => entry.topics[0]?.toLowerCase() === cctpMessageSentTopic,
    );
    if (log === undefined) {
        return undefined;
    }

    const message = decodeMessageBytes(log.data);
    const burn = parseCctpBurnMessage(message);
    return {
        message,
        sourceDomain: burn.sourceDomain,
        destinationDomain: burn.destinationDomain,
        nonce: burn.nonce,
        sender: burn.sender,
        recipient: burn.recipient,
        destinationCaller: burn.destinationCaller,
        amountSent: burn.amount,
        logIndex: log.index ?? 0,
    };
};

export type CctpMintInfo = {
    mintRecipient: string; // bytes32 (from indexed topic)
    mintToken: string; // bytes32 (from indexed topic)
    amount: bigint;
    logIndex: number;
    blockNumber: number;
};

// Pulls the mint details from a destination-chain tx that Circle's forwarding
// service submitted. The tx may contain multiple `MintAndWithdraw` logs if
// Circle batched forwards; callers can filter by `mintRecipient` / `mintToken`.
export const parseCctpMintAndWithdraws = (receipt: {
    blockNumber: number;
    logs: ReadonlyArray<LogLike>;
}): CctpMintInfo[] => {
    return receipt.logs
        .filter(
            (entry) =>
                entry.topics[0]?.toLowerCase() === cctpMintAndWithdrawTopic,
        )
        .map((entry) => ({
            mintRecipient: entry.topics[1] ?? "",
            mintToken: entry.topics[2] ?? "",
            amount: readUint256(entry.data, 0),
            logIndex: entry.index ?? 0,
            blockNumber: receipt.blockNumber,
        }));
};

// Guid encoding: "<sourceDomain>:<sourceTxHash>". The receive lookup hits
// Circle's Iris API at /v2/messages/{sourceDomain}?transactionHash=..., so
// both pieces need to survive in the abstract `BridgeSentEvent.guid`.
export const encodeCctpGuid = (
    sourceDomain: number,
    sourceTxHash: string,
): string => `${sourceDomain}:${sourceTxHash}`;

export const decodeCctpGuid = (
    guid: string,
): { sourceDomain: number; sourceTxHash: string } | undefined => {
    const separator = guid.indexOf(":");
    if (separator < 0) return undefined;
    const sourceDomain = Number.parseInt(guid.slice(0, separator), 10);
    if (!Number.isInteger(sourceDomain) || sourceDomain < 0) return undefined;
    const sourceTxHash = guid.slice(separator + 1);
    if (sourceTxHash.length === 0) return undefined;
    return { sourceDomain, sourceTxHash };
};
