// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import WalletConnectProvider, {
    type RawEvmProvider,
} from "../../src/utils/WalletConnectProvider";

const noopT = ((key: string) => key) as never;
const noopSetter = (() => undefined) as never;

describe("WalletConnectProvider", () => {
    beforeEach(() => {
        WalletConnectProvider.initialize(noopT, noopSetter);
    });

    afterEach(() => {
        WalletConnectProvider.setEvmChainId(undefined);
        WalletConnectProvider.setRawEvmProvider(undefined);
        vi.restoreAllMocks();
    });

    describe("setEvmChainId", () => {
        test("encodes the chain id as a 0x-prefixed lowercase hex string", () => {
            const provider = new WalletConnectProvider();
            WalletConnectProvider.setEvmChainId(30);
            return provider
                .request({ method: "eth_chainId" })
                .then((chainId) => {
                    expect(chainId).toBe("0x1e");
                });
        });

        test("clears the cached chain id when called with undefined", async () => {
            WalletConnectProvider.setEvmChainId(1);
            WalletConnectProvider.setEvmChainId(undefined);

            const provider = new WalletConnectProvider();
            await expect(
                provider.request({ method: "eth_chainId" }),
            ).rejects.toThrow("wallet connect provider not initialized");
        });
    });

    describe("EIP-1193 dispatch", () => {
        test("forwards signTypedData/personal_sign/eth_sendTransaction to the wallet provider, not the read-only RPC", async () => {
            const walletRequest = vi.fn().mockResolvedValue("0xsignature");
            const fakeWallet: RawEvmProvider = {
                request: walletRequest,
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (WalletConnectProvider as any).providers = {
                evm: fakeWallet,
            };

            const provider = new WalletConnectProvider();
            const signingMethods = [
                "personal_sign",
                "eth_signTypedData_v4",
                "eth_sendTransaction",
                "eth_sign",
            ];
            for (const method of signingMethods) {
                await provider.request({
                    method,
                    params: ["0xpayload"],
                });
                expect(walletRequest).toHaveBeenCalledWith({
                    method,
                    params: ["0xpayload"],
                });
            }
        });
    });

    describe("read-only fast-path safety", () => {
        const allowedReadOnlyMethods = [
            "eth_call",
            "eth_estimateGas",
            "eth_gasPrice",
            "eth_maxPriorityFeePerGas",
            "eth_feeHistory",
            "eth_blockNumber",
            "eth_getBalance",
            "eth_getCode",
            "eth_getTransactionByHash",
            "eth_getTransactionCount",
            "eth_getTransactionReceipt",
        ];
        const forbiddenInReadOnly = [
            "personal_sign",
            "eth_sign",
            "eth_signTypedData",
            "eth_signTypedData_v3",
            "eth_signTypedData_v4",
            "eth_sendTransaction",
            "eth_sendRawTransaction",
            "wallet_switchEthereumChain",
            "wallet_addEthereumChain",
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const readOnlySet: ReadonlySet<string> = (WalletConnectProvider as any)
            .evmReadOnlyMethods;

        test.each(allowedReadOnlyMethods)(
            "%s is in evmReadOnlyMethods",
            (method) => {
                expect(readOnlySet.has(method)).toBe(true);
            },
        );

        test.each(forbiddenInReadOnly)(
            "%s MUST NOT be in evmReadOnlyMethods",
            (method) => {
                expect(readOnlySet.has(method)).toBe(false);
            },
        );
    });

    describe("connect / accountRequestResolver lifecycle", () => {
        test("resolveClosePromise rejects pending account request when no address is provided", async () => {
            const provider = new WalletConnectProvider();
            const accountsPromise = provider.request({
                method: "eth_requestAccounts",
            });

            WalletConnectProvider.resolveClosePromise(
                "evm" as never,
                undefined,
                undefined,
            );

            await expect(accountsPromise).rejects.toBe("no_wallet_connected");
        });

        test("resolveClosePromise resolves pending account request with the address", async () => {
            const provider = new WalletConnectProvider();
            const fakeWallet = { request: vi.fn() } as RawEvmProvider;
            const accountsPromise = provider.request({
                method: "eth_requestAccounts",
            });

            WalletConnectProvider.resolveClosePromise(
                "evm" as never,
                fakeWallet,
                "0x1111111111111111111111111111111111111111",
            );

            await expect(accountsPromise).resolves.toEqual([
                "0x1111111111111111111111111111111111111111",
            ]);
        });

        test("a second resolveClosePromise after the resolver was cleared is a no-op", async () => {
            const provider = new WalletConnectProvider();
            const accountsPromise = provider
                .request({ method: "eth_requestAccounts" })
                .catch(() => undefined);

            WalletConnectProvider.resolveClosePromise(
                "evm" as never,
                undefined,
                undefined,
            );
            expect(() =>
                WalletConnectProvider.resolveClosePromise(
                    "evm" as never,
                    undefined,
                    undefined,
                ),
            ).not.toThrow();

            await accountsPromise;
        });
    });
});
