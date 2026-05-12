import { render, waitFor } from "@solidjs/testing-library";
import type * as EvmModule from "boltz-swaps/evm";
import { NetworkTransport } from "boltz-swaps/types";
import type { JSX } from "solid-js";
import type { PublicClient } from "viem";

import { GlobalProvider } from "../../src/context/Global";
import { Web3SignerProvider, useWeb3Signer } from "../../src/context/Web3";
import type * as BoltzClientModule from "../../src/utils/boltzClient";
import { contextWrapper } from "../helper";

const { sentinelAssetProvider, mockGetContracts, mockCreateAssetProvider } =
    vi.hoisted(() => ({
        sentinelAssetProvider: {
            __sentinel: "asset-rpc",
        } as unknown as PublicClient,
        mockGetContracts: vi.fn<typeof BoltzClientModule.getContracts>(),
        mockCreateAssetProvider: vi.fn<typeof EvmModule.createAssetProvider>(),
    }));

vi.mock("../../src/utils/boltzClient", async () => {
    const actual = await vi.importActual<typeof BoltzClientModule>(
        "../../src/utils/boltzClient",
    );
    return { ...actual, getContracts: mockGetContracts };
});

vi.mock("boltz-swaps/evm", async () => {
    const actual = await vi.importActual<typeof EvmModule>("boltz-swaps/evm");
    return { ...actual, createAssetProvider: mockCreateAssetProvider };
});

describe("Web3SignerProvider#browserWalletTransports", () => {
    let context: ReturnType<typeof useWeb3Signer>;

    const Probe = () => {
        context = useWeb3Signer();
        return null;
    };

    const renderProvider = () =>
        render(() => <Probe />, { wrapper: contextWrapper });

    afterEach(() => {
        Reflect.deleteProperty(window, "ethereum");
        Reflect.deleteProperty(window, "tron");
        Reflect.deleteProperty(window, "tronLink");
        Reflect.deleteProperty(window, "tronWeb");
    });

    test("starts empty when no provider is injected", () => {
        renderProvider();

        expect(Array.from(context.browserWalletTransports())).toEqual([]);
    });

    test("detects an injected EVM wallet via window.ethereum", () => {
        Object.defineProperty(window, "ethereum", {
            configurable: true,
            value: { request: () => null },
        });

        renderProvider();

        expect(
            context.browserWalletTransports().has(NetworkTransport.Evm),
        ).toBe(true);
        expect(
            context.browserWalletTransports().has(NetworkTransport.Tron),
        ).toBe(false);
    });

    test.each([["tron"], ["tronLink"], ["tronWeb"]] as const)(
        "detects an injected Tron wallet via window.%s",
        (globalKey) => {
            Object.defineProperty(window, globalKey, {
                configurable: true,
                value: {},
            });

            renderProvider();

            expect(
                context.browserWalletTransports().has(NetworkTransport.Tron),
            ).toBe(true);
            expect(
                context.browserWalletTransports().has(NetworkTransport.Evm),
            ).toBe(false);
        },
    );

    test("reports both transports when EVM and Tron wallets coexist", () => {
        Object.defineProperty(window, "ethereum", {
            configurable: true,
            value: { request: () => null },
        });
        Object.defineProperty(window, "tronLink", {
            configurable: true,
            value: {},
        });

        renderProvider();

        const transports = context.browserWalletTransports();
        expect(transports.has(NetworkTransport.Evm)).toBe(true);
        expect(transports.has(NetworkTransport.Tron)).toBe(true);
        expect(transports.size).toBe(2);
    });

    test("deduplicates Tron when multiple Tron globals are injected", () => {
        Object.defineProperty(window, "tron", {
            configurable: true,
            value: {},
        });
        Object.defineProperty(window, "tronLink", {
            configurable: true,
            value: {},
        });
        Object.defineProperty(window, "tronWeb", {
            configurable: true,
            value: {},
        });

        renderProvider();

        const transports = context.browserWalletTransports();
        expect(Array.from(transports)).toEqual([NetworkTransport.Tron]);
    });
});

describe("Web3SignerProvider#swapClient (cross-chain reads)", () => {
    let context: ReturnType<typeof useWeb3Signer>;

    const Probe = () => {
        context = useWeb3Signer();
        return null;
    };

    const fetchingWrapper = (props: { children: JSX.Element }) => (
        <GlobalProvider>
            <Web3SignerProvider noFetch={false}>
                {props.children}
            </Web3SignerProvider>
        </GlobalProvider>
    );

    beforeEach(() => {
        mockCreateAssetProvider.mockReturnValue(sentinelAssetProvider);
        mockGetContracts.mockResolvedValue({
            anvil: {
                network: { chainId: 33, name: "Anvil" },
                swapContracts: {
                    EtherSwap: "0x0000000000000000000000000000000000000001",
                    ERC20Swap: "0x6398B76DF91C5eBe9f488e3656658E79284dDc0F",
                },
                supportedContracts: {
                    "5": {
                        EtherSwap: "0x0000000000000000000000000000000000000001",
                        ERC20Swap: "0x6398B76DF91C5eBe9f488e3656658E79284dDc0F",
                        features: [],
                    },
                },
                tokens: {},
            },
        } as never);
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "ethereum");
        vi.clearAllMocks();
    });

    const stubInjectedEvmProvider = () => {
        Object.defineProperty(window, "ethereum", {
            configurable: true,
            value: {
                request: vi.fn(({ method }: { method: string }) =>
                    Promise.resolve(
                        method === "eth_requestAccounts"
                            ? ["0x1111111111111111111111111111111111111111"]
                            : [],
                    ),
                ),
                on: vi.fn(),
                removeAllListeners: vi.fn(),
            },
        });
    };

    test("getErc20Swap reads via createAssetProvider even when a signer is connected", async () => {
        // Regression guard: pre-fix, swapClient fell back to
        // `connectedSigner.provider` whenever a signer was connected, which
        // breaks cross-chain claims (wallet on chain A, Erc20Swap on chain B).
        // The fix is "always call createAssetProvider(asset)" — assert it.
        stubInjectedEvmProvider();
        render(() => <Probe />, { wrapper: fetchingWrapper });
        await context.connectProvider("browser");
        await waitFor(() => {
            expect(context.signer()).toBeDefined();
            expect(
                context.getContractsForAsset("RBTC")?.swapContracts.ERC20Swap,
            ).toBeDefined();
        });

        mockCreateAssetProvider.mockClear();
        context.getErc20Swap("RBTC");

        expect(mockCreateAssetProvider).toHaveBeenCalledWith("RBTC");
        expect(mockCreateAssetProvider).toHaveBeenCalledTimes(1);
    });

    test("getEtherSwap reads via createAssetProvider even when a signer is connected", async () => {
        stubInjectedEvmProvider();
        render(() => <Probe />, { wrapper: fetchingWrapper });
        await context.connectProvider("browser");
        await waitFor(() => {
            expect(context.signer()).toBeDefined();
            expect(
                context.getContractsForAsset("RBTC")?.swapContracts.EtherSwap,
            ).toBeDefined();
        });

        mockCreateAssetProvider.mockClear();
        context.getEtherSwap("RBTC");

        expect(mockCreateAssetProvider).toHaveBeenCalledWith("RBTC");
    });

    test("getErc20Swap also uses createAssetProvider when no signer is connected", async () => {
        render(() => <Probe />, { wrapper: fetchingWrapper });
        await waitFor(() => {
            expect(
                context.getContractsForAsset("RBTC")?.swapContracts.ERC20Swap,
            ).toBeDefined();
        });

        mockCreateAssetProvider.mockClear();
        context.getErc20Swap("RBTC");

        expect(mockCreateAssetProvider).toHaveBeenCalledWith("RBTC");
    });
});
