import { type Signer } from "boltz-swaps/interfaces";
import {
    type MsgFee,
    type SendParam,
    createEvmOftContract,
    oftAbi,
    toViemSendParam,
} from "boltz-swaps/oft";
import { encodeEventTopics, keccak256, toBytes } from "viem";

describe("toViemSendParam", () => {
    const validSendParam: SendParam = [
        30420,
        `0x${"00".repeat(32)}`,
        100n,
        99n,
        "0x",
        "0x",
        "0x",
    ];

    test("maps the positional tuple to the named viem struct", () => {
        const result = toViemSendParam(validSendParam);
        expect(result).toEqual({
            dstEid: 30420,
            to: `0x${"00".repeat(32)}`,
            amountLD: 100n,
            minAmountLD: 99n,
            extraOptions: "0x",
            composeMsg: "0x",
            oftCmd: "0x",
        });
    });

    test("preserves bytes32 recipient bytes verbatim", () => {
        const recipient =
            "0x000000000000000000000000abcdef0123456789abcdef0123456789abcdef01";
        const result = toViemSendParam([
            1,
            recipient,
            1n,
            1n,
            "0x",
            "0x",
            "0x",
        ] as unknown as SendParam);
        expect(result.to).toBe(recipient);
    });

    test("rejects non-hex recipient", () => {
        // Guards against base58 (Solana/Tron) leaking into bytes32.
        expect(() =>
            toViemSendParam([
                1,
                "not-hex" as never,
                1n,
                1n,
                "0x",
                "0x",
                "0x",
            ] as unknown as SendParam),
        ).toThrow("invalid OFT recipient");
    });

    test("rejects non-hex extraOptions / composeMsg / oftCmd", () => {
        const recipient = `0x${"00".repeat(32)}` as const;
        expect(() =>
            toViemSendParam([
                1,
                recipient,
                1n,
                1n,
                "garbage",
                "0x",
                "0x",
            ] as unknown as SendParam),
        ).toThrow("invalid OFT extra options");
        expect(() =>
            toViemSendParam([
                1,
                recipient,
                1n,
                1n,
                "0x",
                "garbage",
                "0x",
            ] as unknown as SendParam),
        ).toThrow("invalid OFT compose message");
        expect(() =>
            toViemSendParam([
                1,
                recipient,
                1n,
                1n,
                "0x",
                "0x",
                "garbage",
            ] as unknown as SendParam),
        ).toThrow("invalid OFT command");
    });
});

describe("OFT event topic hashes", () => {
    test("OFTSent topic matches keccak256 of the canonical event signature", () => {
        const expected = keccak256(
            toBytes("OFTSent(bytes32,uint32,address,uint256,uint256)"),
        );
        const [topic] = encodeEventTopics({
            abi: oftAbi,
            eventName: "OFTSent",
        });
        expect(topic).toBe(expected);
    });

    test("OFTReceived topic matches keccak256 of the canonical event signature", () => {
        const expected = keccak256(
            toBytes("OFTReceived(bytes32,uint32,address,uint256)"),
        );
        const [topic] = encodeEventTopics({
            abi: oftAbi,
            eventName: "OFTReceived",
        });
        expect(topic).toBe(expected);
    });

    test("OFTSent has guid and fromAddress as indexed (filter-by-guid only works if these are topics)", () => {
        const oftSent = oftAbi.find(
            (item) => item.type === "event" && item.name === "OFTSent",
        );
        if (oftSent === undefined || oftSent.type !== "event") {
            throw new Error("expected OFTSent in oftAbi");
        }
        const indexedNames = oftSent.inputs
            .filter((input) => "indexed" in input && input.indexed === true)
            .map((input) => input.name);
        expect(indexedNames).toEqual(["guid", "fromAddress"]);
    });

    test("OFTReceived has guid and toAddress as indexed", () => {
        const oftReceived = oftAbi.find(
            (item) => item.type === "event" && item.name === "OFTReceived",
        );
        if (oftReceived === undefined || oftReceived.type !== "event") {
            throw new Error("expected OFTReceived in oftAbi");
        }
        const indexedNames = oftReceived.inputs
            .filter((input) => "indexed" in input && input.indexed === true)
            .map((input) => input.name);
        expect(indexedNames).toEqual(["guid", "toAddress"]);
    });
});

describe("createEvmOftContract send", () => {
    const oftAddress = "0x6BA10300f0DC58B7a1e4c0e41f5daBb7D7829e13";
    const refundAddress = "0x8382Ab573C5E48270Abb1b0A76564F76eEbc24c5";
    const sendParam: SendParam = [
        30110,
        `0x${"00".repeat(32)}`,
        1n,
        1n,
        "0x",
        "0x",
        "0x",
    ];
    const msgFee: MsgFee = [100n, 0n];

    const buildSigner = (writeContract: ReturnType<typeof vi.fn>): Signer => {
        const account = { address: refundAddress, type: "json-rpc" } as const;
        return {
            account,
            address: refundAddress,
            sendTransaction: vi.fn(),
            writeContract,
            provider: {
                readContract: vi.fn(),
            },
        } as unknown as Signer;
    };

    test("passes chain: null so viem skips its chain assertion", async () => {
        // viem throws ChainNotFoundError when chain is undefined and the
        // wallet client wasn't created with one — null is the documented
        // opt-out.
        const writeContract = vi.fn().mockResolvedValue("0xdeadbeef");
        const signer = buildSigner(writeContract);

        const contract = createEvmOftContract(oftAddress, signer);
        await contract.send(sendParam, msgFee, refundAddress, { value: 100n });

        expect(writeContract).toHaveBeenCalledTimes(1);
        const [params] = writeContract.mock.calls[0];
        expect(params.chain).toBe(null);
        expect(params.functionName).toBe("send");
        expect(params.address).toBe(oftAddress);
        expect(params.value).toBe(100n);
    });

    test("throws when constructed against a read-only public client", async () => {
        const publicClient = {
            readContract: vi.fn(),
        } as unknown as Parameters<typeof createEvmOftContract>[1];
        const contract = createEvmOftContract(oftAddress, publicClient);
        await expect(
            contract.send(sendParam, msgFee, refundAddress, undefined),
        ).rejects.toThrow("OFT send requires a wallet client");
    });
});

describe("ClaimSend typehash (Router auth-signature)", () => {
    test("canonical type string produces a stable typehash", () => {
        const canonical =
            "ClaimSend(bytes32 preimage,address token,address oft,bytes32 sendData,uint256 minAmountLD,uint256 lzTokenFee,address refundAddress)";
        const typehash = keccak256(toBytes(canonical));
        expect(typehash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(typehash).toBe(
            "0xd574e98ae922e812083482a53f290e4a94af4ec6bc2d9490b0386edcf40dfecf",
        );
    });

    test("changes when a field is renamed (regression guard against silent type drift)", () => {
        const canonical =
            "ClaimSend(bytes32 preimage,address token,address oft,bytes32 sendData,uint256 minAmountLD,uint256 lzTokenFee,address refundAddress)";
        const renamed =
            "ClaimSend(bytes32 preimage,address token,address oft,bytes32 sendData,uint256 minAmountLd,uint256 lzTokenFee,address refundAddress)";
        expect(keccak256(toBytes(canonical))).not.toBe(
            keccak256(toBytes(renamed)),
        );
    });

    test("changes when a field is reordered", () => {
        const canonical =
            "ClaimSend(bytes32 preimage,address token,address oft,bytes32 sendData,uint256 minAmountLD,uint256 lzTokenFee,address refundAddress)";
        const reordered =
            "ClaimSend(bytes32 preimage,address token,bytes32 sendData,address oft,uint256 minAmountLD,uint256 lzTokenFee,address refundAddress)";
        expect(keccak256(toBytes(canonical))).not.toBe(
            keccak256(toBytes(reordered)),
        );
    });
});
