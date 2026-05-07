// @vitest-environment node
import type { PublicClient } from "viem";
import { afterEach, describe, expect, test, vi } from "vitest";

import trezorLoader from "../../../src/lazy/trezor";
import TrezorSigner from "../../../src/utils/hardware/TrezorSigner";

const buildProviderStub = (
    overrides: Partial<Record<keyof PublicClient, unknown>> = {},
) =>
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
        ...overrides,
    }) as unknown as PublicClient;

const stubLoader = (overrides: Record<string, unknown> = {}) => {
    const ethereumSignTransaction = vi.fn().mockResolvedValue({
        success: true,
        payload: {
            r: "0x1111111111111111111111111111111111111111111111111111111111111111",
            s: "0x2222222222222222222222222222222222222222222222222222222222222222",
            v: "0x60",
        },
    });
    const ethereumGetAddress = vi.fn().mockResolvedValue({
        success: true,
        payload: { address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" },
    });
    const connect = {
        init: vi.fn().mockResolvedValue(undefined),
        ethereumSignTransaction,
        ethereumGetAddress,
        ...overrides,
    };
    vi.spyOn(trezorLoader, "get").mockResolvedValue(connect as never);
    return { connect, ethereumSignTransaction, ethereumGetAddress };
};

const buildSigner = (provider: PublicClient) => {
    const signer = new TrezorSigner();
    Reflect.set(signer, "provider", provider);
    Reflect.set(signer, "initialized", true);
    signer.setDerivationPath("44'/60'/0'/0/0");
    return signer;
};

const buildUninitializedSigner = (provider: PublicClient) => {
    const signer = new TrezorSigner();
    Reflect.set(signer, "provider", provider);
    signer.setDerivationPath("44'/60'/0'/0/0");
    return signer;
};

const baseTxParams = {
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    data: "0xabcdef",
    value: "0x1c6bf52634000", // 0.0005 ETH in hex
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("TrezorSigner.request eth_sendTransaction gas-fallback wiring", () => {
    test("estimates gas in parallel and threads it through to the signed tx when txParams omits gas", async () => {
        const provider = buildProviderStub();
        const { ethereumSignTransaction } = stubLoader();
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

        expect(ethereumSignTransaction).toHaveBeenCalledTimes(1);
        const [{ transaction }] = ethereumSignTransaction.mock.calls[0];
        expect(transaction.gasLimit).toBe("0x1e240"); // hex(123_456)
    });

    test("skips gas estimation when txParams already carries gas", async () => {
        const provider = buildProviderStub();
        stubLoader();
        const signer = buildSigner(provider);

        await signer.request({
            method: "eth_sendTransaction",
            params: [{ ...baseTxParams, gas: "0xf4240" }], // 1_000_000
        });

        expect(provider.estimateGas).not.toHaveBeenCalled();
    });

    test("skips gas estimation when txParams carries gasLimit (alternate field name)", async () => {
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

describe("TrezorSigner.initialize", () => {
    test("rethrows non-'already initialized' errors instead of swallowing", async () => {
        const provider = buildProviderStub();
        const popupBlocked = new Error("Popup not allowed");
        const { connect } = stubLoader({
            init: vi.fn().mockRejectedValue(popupBlocked),
        });
        const signer = buildUninitializedSigner(provider);

        await expect(
            signer.request({ method: "eth_requestAccounts" }),
        ).rejects.toBe(popupBlocked);

        expect(connect.init).toHaveBeenCalledTimes(1);
        expect(connect.ethereumGetAddress).not.toHaveBeenCalled();
        expect(Reflect.get(signer, "initialized")).toBe(false);
    });

    test("treats the SDK's 'already initialized' string as a no-op success", async () => {
        const provider = buildProviderStub();
        const { connect } = stubLoader({
            init: vi
                .fn()
                .mockRejectedValue(
                    new Error("TrezorConnect has been already initialized"),
                ),
        });
        const signer = buildUninitializedSigner(provider);

        await expect(
            signer.request({ method: "eth_requestAccounts" }),
        ).resolves.toEqual(["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"]);

        expect(Reflect.get(signer, "initialized")).toBe(true);
        // A second request must hit the fast path without re-calling init.
        await signer.request({ method: "eth_requestAccounts" });
        expect(connect.init).toHaveBeenCalledTimes(1);
    });

    test("retries init after a real failure (in-flight cache cleared on rejection)", async () => {
        const provider = buildProviderStub();
        const init = vi
            .fn()
            .mockRejectedValueOnce(new Error("Transport error"))
            .mockResolvedValueOnce(undefined);
        stubLoader({ init });
        const signer = buildUninitializedSigner(provider);

        await expect(
            signer.request({ method: "eth_requestAccounts" }),
        ).rejects.toThrow("Transport error");

        await expect(
            signer.request({ method: "eth_requestAccounts" }),
        ).resolves.toEqual(["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"]);

        expect(init).toHaveBeenCalledTimes(2);
        expect(Reflect.get(signer, "initialized")).toBe(true);
    });

    test("dedups concurrent initialise calls — connect.init runs once for two parallel requests", async () => {
        const provider = buildProviderStub();
        let resolveInit!: () => void;
        const initPromise = new Promise<void>((resolve) => {
            resolveInit = resolve;
        });
        const init = vi.fn().mockReturnValue(initPromise);
        stubLoader({ init });
        const signer = buildUninitializedSigner(provider);

        const first = signer.request({ method: "eth_requestAccounts" });
        const second = signer.request({ method: "eth_requestAccounts" });

        await new Promise((r) => setTimeout(r, 0));
        expect(init).toHaveBeenCalledTimes(1);

        resolveInit();
        await Promise.all([first, second]);
        expect(init).toHaveBeenCalledTimes(1);
    });
});
