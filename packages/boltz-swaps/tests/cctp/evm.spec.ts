import {
    type CctpData,
    addressToBytes32,
    cctpDataTypehash,
    cctpEmptyHookData,
    cctpForwardHookData,
    cctpZeroBytes32,
    createCctpSolanaForwardHookData,
    encodeCctpReceiveMessage,
    hashCctpData,
} from "boltz-swaps/cctp";
import { keccak256, toBytes } from "viem";

describe("cctp evm helpers", () => {
    test.each([
        {
            recipient: "11111111111111111111111111111111",
            expected:
                "0x636374702d666f72776172640000000000000000000000000000000000000021010000000000000000000000000000000000000000000000000000000000000000",
        },
        {
            recipient: "EwwMqF8sFZRBGLchFfq61g5U7mPB14EnXxLQDWb5VAe5",
            expected:
                "0x636374702d666f7277617264000000000000000000000000000000000000002101cf3ac201d92eadcae0cd69b431f4c0e6d96c06bdb2fa28271b00409b5f1622ca",
        },
    ])(
        "createCctpSolanaForwardHookData encodes Solana recipient $recipient",
        ({ recipient, expected }) => {
            expect(createCctpSolanaForwardHookData(recipient)).toBe(expected);
        },
    );

    test("keeps the EVM forwarding hook data unchanged", () => {
        expect(cctpForwardHookData).toBe(
            "0x636374702d666f72776172640000000000000000000000000000000000000000",
        );
    });

    test("CCTP zero/empty constants match the on-chain expectation", () => {
        expect(cctpZeroBytes32).toBe(`0x${"00".repeat(32)}`);
        expect(cctpEmptyHookData).toBe("0x");
    });

    test("cctpDataTypehash matches the canonical Router TYPEHASH_CCTP_DATA", () => {
        const canonicalType =
            "CctpData(uint32 destinationDomain,bytes32 mintRecipient,bytes32 destinationCaller,uint256 maxFee,uint32 minFinalityThreshold,bytes32 hookData)";
        expect(cctpDataTypehash).toBe(keccak256(toBytes(canonicalType)));
        expect(cctpDataTypehash).toBe(
            "0x9b5b1c929227bcc37f83e385e88fc739668266cfce6830b07fceef394627016f",
        );
    });

    describe("addressToBytes32", () => {
        test("left-pads a 20-byte address to bytes32", () => {
            expect(
                addressToBytes32("0x1234567890123456789012345678901234567890"),
            ).toBe(
                "0x0000000000000000000000001234567890123456789012345678901234567890",
            );
        });

        test("normalizes the address to its EIP-55 checksum before padding", () => {
            const padded = addressToBytes32(
                "0xabababababababababababababababababababab",
            );
            expect(padded).toMatch(/^0x[0-9a-fA-F]{64}$/);
            expect(padded.slice(-40).toLowerCase()).toBe(
                "abababababababababababababababababababab",
            );
        });

        test("produces a 32-byte (66-char) 0x-prefixed hex", () => {
            const padded = addressToBytes32(
                "0x0000000000000000000000000000000000000001",
            );
            expect(padded).toHaveLength(2 + 64);
        });
    });

    describe("hashCctpData", () => {
        const sample: CctpData = {
            destinationDomain: 0,
            mintRecipient: addressToBytes32(
                "0x1111111111111111111111111111111111111111",
            ),
            destinationCaller: cctpZeroBytes32 as `0x${string}`,
            maxFee: 100n,
            minFinalityThreshold: 1000,
            hookData: cctpEmptyHookData as `0x${string}`,
        };

        test("produces a stable 32-byte hash for a fixed CctpData", () => {
            const hash = hashCctpData(sample);
            expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
            expect(hash).toBe(
                "0x7680d81fad262508a7c1de25f63bb8fa2d7594056fa551b9978e34330c5941c5",
            );
        });

        test("changes when destinationDomain changes", () => {
            const hashA = hashCctpData(sample);
            const hashB = hashCctpData({ ...sample, destinationDomain: 7 });
            expect(hashA).not.toBe(hashB);
        });

        test("changes when hookData changes (forward vs empty)", () => {
            const hashEmpty = hashCctpData(sample);
            const hashForward = hashCctpData({
                ...sample,
                hookData: cctpForwardHookData as `0x${string}`,
            });
            expect(hashEmpty).not.toBe(hashForward);
        });

        test("changes when maxFee changes", () => {
            const hashA = hashCctpData(sample);
            const hashB = hashCctpData({ ...sample, maxFee: 999n });
            expect(hashA).not.toBe(hashB);
        });
    });

    describe("encodeCctpReceiveMessage", () => {
        test("encodes the receiveMessage(bytes,bytes) selector and arguments", () => {
            const message = "0xdeadbeef" as const;
            const attestation = "0xfeedface" as const;
            const calldata = encodeCctpReceiveMessage(message, attestation);

            expect(calldata.startsWith("0x57ecfd28")).toBe(true);
            expect(calldata.includes("deadbeef")).toBe(true);
            expect(calldata.includes("feedface")).toBe(true);
        });
    });
});
