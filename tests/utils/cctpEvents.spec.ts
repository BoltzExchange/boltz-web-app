import {
    cctpMessageSentTopic,
    cctpMintAndWithdrawTopic,
    decodeCctpGuid,
    encodeCctpGuid,
    parseCctpMessageSent,
    parseCctpMintAndWithdraws,
} from "../../src/utils/cctp/events";

// Build an ABI-encoded `MessageSent(bytes)` log data payload. The `bytes`
// encoding is: [32 bytes offset=0x20][32 bytes length][message padded to 32].
const encodeBytesData = (hex: string): string => {
    const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
    const lengthBytes = stripped.length / 2;
    const lengthHex = lengthBytes.toString(16).padStart(64, "0");
    // pad content up to a multiple of 32 bytes
    const paddingBytes = (32 - (lengthBytes % 32)) % 32;
    const paddedContent = stripped + "00".repeat(paddingBytes);
    return `0x${"20".padStart(64, "0")}${lengthHex}${paddedContent}`;
};

const u32Hex = (n: number) => n.toString(16).padStart(8, "0");
const u256Hex = (n: bigint) => n.toString(16).padStart(64, "0");

// Assemble a minimal valid v2 outer message with a BurnMessage body.
// Outer: version(4) + srcDomain(4) + dstDomain(4) + nonce(32) + sender(32)
//        + recipient(32) + destinationCaller(32) + minFinalityThreshold(4)
//        + finalityThresholdExecuted(4) + messageBody
// BurnMessage body: version(4) + burnToken(32) + mintRecipient(32) + amount(32)
//                   + messageSender(32) + maxFee(32) + feeExecuted(32)
//                   + expirationBlock(32) + hookData
const buildCctpMessage = ({
    sourceDomain,
    destinationDomain,
    sender,
    recipient,
    amount,
}: {
    sourceDomain: number;
    destinationDomain: number;
    sender: string;
    recipient: string;
    amount: bigint;
}): string => {
    const strip = (h: string) => (h.startsWith("0x") ? h.slice(2) : h);
    const header =
        u32Hex(2) + // version=2
        u32Hex(sourceDomain) +
        u32Hex(destinationDomain) +
        "00".repeat(32) + // nonce
        strip(sender).padStart(64, "0") +
        strip(recipient).padStart(64, "0") +
        "00".repeat(32) + // destinationCaller
        u32Hex(1000) + // minFinalityThreshold
        u32Hex(1000); // finalityThresholdExecuted
    const body =
        u32Hex(1) + // burn message version
        "00".repeat(32) + // burnToken
        strip(recipient).padStart(64, "0") + // mintRecipient
        u256Hex(amount) +
        "00".repeat(32) + // messageSender
        "00".repeat(32) + // maxFee
        "00".repeat(32) + // feeExecuted
        "00".repeat(32); // expirationBlock
    return `0x${header}${body}`;
};

describe("cctp events", () => {
    test("topic constants are 32-byte hex strings", () => {
        // The actual hashes were verified against a real keccak256 out of
        // band (see the CI / dev script); here we just sanity-check the
        // constants didn't get mangled. The global test mock stubs
        // keccak256, so we can't recompute in-process.
        expect(cctpMessageSentTopic).toMatch(/^0x[0-9a-f]{64}$/);
        expect(cctpMintAndWithdrawTopic).toMatch(/^0x[0-9a-f]{64}$/);
    });

    test("parseCctpMessageSent decodes a MessageSent log", () => {
        const recipient = "0x000000000000000000000000" + "11".repeat(20);
        const sender = "0x000000000000000000000000" + "22".repeat(20);
        const message = buildCctpMessage({
            sourceDomain: 3,
            destinationDomain: 6,
            sender,
            recipient,
            amount: 1_000_000n,
        });

        const info = parseCctpMessageSent({
            logs: [
                {
                    topics: [cctpMessageSentTopic],
                    data: encodeBytesData(message),
                    index: 7,
                },
            ],
        });

        expect(info).toBeDefined();
        expect(info!.sourceDomain).toBe(3);
        expect(info!.destinationDomain).toBe(6);
        expect(info!.sender.toLowerCase()).toBe(sender.toLowerCase());
        expect(info!.recipient.toLowerCase()).toBe(recipient.toLowerCase());
        expect(info!.amountSent).toBe(1_000_000n);
        expect(info!.logIndex).toBe(7);
        expect(info!.message).toBe(message);
    });

    test("parseCctpMessageSent returns undefined when no MessageSent log", () => {
        expect(
            parseCctpMessageSent({
                logs: [{ topics: ["0xdeadbeef"], data: "0x" }],
            }),
        ).toBeUndefined();
    });

    test("parseCctpMintAndWithdraws decodes amount and indexed topics", () => {
        const recipientTopic = "0x000000000000000000000000" + "aa".repeat(20);
        const tokenTopic = "0x000000000000000000000000" + "bb".repeat(20);
        const mints = parseCctpMintAndWithdraws({
            blockNumber: 42,
            logs: [
                {
                    topics: [
                        cctpMintAndWithdrawTopic,
                        recipientTopic,
                        tokenTopic,
                    ],
                    data: `0x${u256Hex(987_654n)}`,
                    index: 3,
                },
                { topics: ["0xunrelated"], data: "0x" },
            ],
        });

        expect(mints).toHaveLength(1);
        expect(mints[0]).toEqual({
            mintRecipient: recipientTopic,
            mintToken: tokenTopic,
            amount: 987_654n,
            logIndex: 3,
            blockNumber: 42,
        });
    });

    test("encodeCctpGuid / decodeCctpGuid round-trip", () => {
        const sourceTxHash =
            "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
        const guid = encodeCctpGuid(3, sourceTxHash);
        expect(guid).toBe(`3:${sourceTxHash}`);
        expect(decodeCctpGuid(guid)).toEqual({
            sourceDomain: 3,
            sourceTxHash,
        });
    });

    test("decodeCctpGuid rejects malformed guids", () => {
        expect(decodeCctpGuid("")).toBeUndefined();
        expect(decodeCctpGuid("notx")).toBeUndefined();
        expect(decodeCctpGuid("notanumber:hash")).toBeUndefined();
        expect(decodeCctpGuid("3:")).toBeUndefined();
    });
});
