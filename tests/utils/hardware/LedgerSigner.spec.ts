// @vitest-environment node
import type { PublicClient } from "viem";
import { hashDomain, hashStruct } from "viem";
import { afterEach, describe, expect, test, vi } from "vitest";

import ledgerLoader from "../../../src/lazy/ledger";
import LedgerSigner from "../../../src/utils/hardware/LedgerSigner";

const buildProviderStub = () =>
    ({
        getTransactionCount: vi.fn().mockResolvedValue(7),
        getChainId: vi.fn().mockResolvedValue(30),
        estimateFeesPerGas: vi.fn().mockResolvedValue({
            maxFeePerGas: 11n,
            maxPriorityFeePerGas: 1n,
        }),
        getGasPrice: vi.fn().mockResolvedValue(5n),
        estimateGas: vi.fn().mockResolvedValue(123_456n),
        sendRawTransaction: vi.fn().mockResolvedValue("0xsent"),
        request: vi.fn().mockRejectedValue(new Error("no fallthrough")),
    }) as unknown as PublicClient;

// `getApp` parses transport.send(0xb0,…) bytes as:
//   [format=1][nameLen][name…][versionLen][version…][flagLen][flags…]
const buildAppHeader = (name: string) => {
    const nameBytes = Buffer.from(name, "ascii");
    const versionBytes = Buffer.from("1.0.0", "ascii");
    return Buffer.concat([
        Buffer.from([0x01]),
        Buffer.from([nameBytes.length]),
        nameBytes,
        Buffer.from([versionBytes.length]),
        versionBytes,
        Buffer.from([0x01, 0x00]),
    ]);
};

const stubLoader = (
    overrides: {
        signEIP712Message?: ReturnType<typeof vi.fn>;
        signEIP712HashedMessage?: ReturnType<typeof vi.fn>;
    } = {},
) => {
    const clearSignTransaction = vi.fn().mockResolvedValue({
        r: "1111111111111111111111111111111111111111111111111111111111111111",
        s: "2222222222222222222222222222222222222222222222222222222222222222",
        v: "1c",
    });
    const signEIP712Message =
        overrides.signEIP712Message ??
        vi.fn().mockResolvedValue({
            r: "3333333333333333333333333333333333333333333333333333333333333333",
            s: "4444444444444444444444444444444444444444444444444444444444444444",
            v: "1c",
        });
    const signEIP712HashedMessage =
        overrides.signEIP712HashedMessage ??
        vi.fn().mockResolvedValue({
            r: "5555555555555555555555555555555555555555555555555555555555555555",
            s: "6666666666666666666666666666666666666666666666666666666666666666",
            v: "1c",
        });
    class FakeEth {
        public clearSignTransaction = clearSignTransaction;
        public signEIP712Message = signEIP712Message;
        public signEIP712HashedMessage = signEIP712HashedMessage;
        public getAddress = vi.fn();
    }
    const transportSend = vi.fn().mockResolvedValue(buildAppHeader("Ethereum"));
    const transport = {
        send: transportSend,
        close: vi.fn().mockResolvedValue(undefined),
    };
    const modules = {
        eth: FakeEth as never,
        webhid: { create: vi.fn().mockResolvedValue(transport) },
    };
    vi.spyOn(ledgerLoader, "get").mockResolvedValue(modules as never);
    return {
        clearSignTransaction,
        signEIP712Message,
        signEIP712HashedMessage,
        transportSend,
    };
};

const buildTypedDataPayload = () => ({
    types: {
        EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
        ],
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    },
    primaryType: "Permit",
    domain: {
        name: "USD Coin",
        version: "2",
        chainId: 137,
        verifyingContract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    },
    message: {
        owner: "0x1111111111111111111111111111111111111111",
        spender: "0x2222222222222222222222222222222222222222",
        value: "1000",
        nonce: "0",
        deadline: "9999999999",
    },
});

const buildSigner = (provider: PublicClient) => {
    const signer = new LedgerSigner((key) => key);
    Reflect.set(signer, "provider", provider);
    signer.setDerivationPath("44'/60'/0'/0/0");
    return signer;
};

const baseTxParams = {
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    data: "0xabcdef",
    value: "0x1c6bf52634000",
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("LedgerSigner.request eth_sendTransaction gas-fallback wiring", () => {
    test("estimates gas in parallel and signs a tx whose serialized payload reflects the estimate", async () => {
        const provider = buildProviderStub();
        const { clearSignTransaction } = stubLoader();
        const signer = buildSigner(provider);

        await signer.request({
            method: "eth_sendTransaction",
            params: [baseTxParams],
        });

        expect(provider.estimateGas).toHaveBeenCalledTimes(1);
        expect(provider.estimateGas).toHaveBeenCalledWith({
            account: "0x1111111111111111111111111111111111111111",
            to: "0x2222222222222222222222222222222222222222",
            data: "0xabcdef",
            value: 500_000_000_000_000n,
        });

        expect(clearSignTransaction).toHaveBeenCalledTimes(1);
        const [, unsignedHex] = clearSignTransaction.mock.calls[0];
        // 123_456 = 0x01e240; viem RLP-encodes the gas field as `83 01 e2 40`
        // (3-byte short string prefix). Asserting on the substring keeps the
        // test resilient to other field order changes.
        expect(unsignedHex).toContain("8301e240");
    });

    test("skips gas estimation when txParams already carries gas", async () => {
        const provider = buildProviderStub();
        stubLoader();
        const signer = buildSigner(provider);

        await signer.request({
            method: "eth_sendTransaction",
            params: [{ ...baseTxParams, gas: "0xf4240" }],
        });

        expect(provider.estimateGas).not.toHaveBeenCalled();
    });

    test("skips gas estimation when txParams carries gasLimit", async () => {
        const provider = buildProviderStub();
        stubLoader();
        const signer = buildSigner(provider);

        await signer.request({
            method: "eth_sendTransaction",
            params: [{ ...baseTxParams, gasLimit: "0xf4240" }],
        });

        expect(provider.estimateGas).not.toHaveBeenCalled();
    });
});

describe("LedgerSigner.request eth_signTypedData_v4", () => {
    const sender = "0x1111111111111111111111111111111111111111";

    test("uses clear-sign on the happy path and never falls back", async () => {
        const provider = buildProviderStub();
        const { signEIP712Message, signEIP712HashedMessage } = stubLoader();
        const signer = buildSigner(provider);

        await signer.request({
            method: "eth_signTypedData_v4",
            params: [sender, JSON.stringify(buildTypedDataPayload())],
        });

        expect(signEIP712Message).toHaveBeenCalledTimes(1);
        expect(signEIP712HashedMessage).not.toHaveBeenCalled();
    });

    test("Nano S fallback: clones types so hashDomain still has EIP712Domain", async () => {
        const provider = buildProviderStub();
        const fallbackErr = new Error(
            "Ledger device: clear signing not supported",
        );
        const signEIP712Message = vi.fn().mockRejectedValue(fallbackErr);
        const signEIP712HashedMessage = vi.fn().mockResolvedValue({
            r: "7777777777777777777777777777777777777777777777777777777777777777",
            s: "8888888888888888888888888888888888888888888888888888888888888888",
            v: "1c",
        });
        stubLoader({ signEIP712Message, signEIP712HashedMessage });
        const signer = buildSigner(provider);

        const payload = buildTypedDataPayload();

        await expect(
            signer.request({
                method: "eth_signTypedData_v4",
                params: [sender, JSON.stringify(payload)],
            }),
        ).resolves.toMatch(/^0x[0-9a-f]+$/);

        expect(signEIP712Message).toHaveBeenCalledTimes(1);
        expect(signEIP712HashedMessage).toHaveBeenCalledTimes(1);

        const [path, capturedDomainHash, capturedMsgHash] =
            signEIP712HashedMessage.mock.calls[0];
        expect(path).toBe("44'/60'/0'/0/0");

        const typesWithoutDomain = { ...payload.types };
        delete (typesWithoutDomain as Record<string, unknown>).EIP712Domain;
        expect(capturedDomainHash).toBe(
            hashDomain({
                domain: payload.domain,
                types: payload.types,
            } as never),
        );
        expect(capturedMsgHash).toBe(
            hashStruct({
                primaryType: payload.primaryType,
                types: typesWithoutDomain,
                data: payload.message,
            } as never),
        );
    });
});
