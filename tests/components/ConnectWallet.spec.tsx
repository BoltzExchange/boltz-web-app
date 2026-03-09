import { Route, Router } from "@solidjs/router";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import BigNumber from "bignumber.js";
import { createEffect, createMemo, createSignal } from "solid-js";

vi.mock("ethers", () => {
    class MockJsonRpcProvider {
        public send = vi.fn();
        public getTransactionCount = vi.fn();
        public getNetwork = vi.fn();
        public getFeeData = vi.fn();
    }

    class MockFallbackProvider extends MockJsonRpcProvider {}

    class MockBrowserProvider {
        constructor(
            private readonly provider: {
                request: (request: {
                    method: string;
                    params?: Array<unknown>;
                }) => Promise<unknown>;
            },
        ) {}

        public getNetwork = async () => {
            const chainId = (await this.provider.request({
                method: "eth_chainId",
            })) as string;

            return {
                chainId: BigInt(chainId),
            };
        };
    }

    class MockJsonRpcSigner {
        public readonly provider: MockBrowserProvider;
        public readonly address: string;

        constructor(provider: MockBrowserProvider, address: string) {
            this.provider = provider;
            this.address = address;
        }

        public getAddress = () => this.address;
    }

    class MockContract {
        constructor(
            public readonly address?: string,
            public readonly abi?: unknown,
            public readonly runner?: unknown,
        ) {}
    }

    class MockWallet {
        public address = "0x0000000000000000000000000000000000000000";

        constructor() {}
    }

    return {
        BrowserProvider: MockBrowserProvider,
        Contract: MockContract,
        FallbackProvider: MockFallbackProvider,
        JsonRpcProvider: MockJsonRpcProvider,
        JsonRpcSigner: MockJsonRpcSigner,
        Signature: {
            from: vi.fn((value: unknown) => value),
        },
        Transaction: {
            from: vi.fn(),
        },
        TypedDataEncoder: {
            hashDomain: vi.fn(),
            hashStruct: vi.fn(),
        },
        Wallet: MockWallet,
    };
});

vi.mock("../../src/utils/boltzClient", async () => {
    const { config } = await import("../../src/config");

    return {
        getContracts: vi.fn().mockResolvedValue({
            rbtc: {
                network: {
                    chainId: config.assets.RBTC.network.chainId,
                },
                supportedContracts: {},
                swapContracts: {},
            },
        }),
    };
});

const { RBTC } = await import("../../src/consts/Assets");
const { CreateProvider, useCreateContext } =
    await import("../../src/context/Create");
const { GlobalProvider } = await import("../../src/context/Global");
const { Web3SignerProvider, useWeb3Signer } =
    await import("../../src/context/Web3");
const { default: ConnectWallet } =
    await import("../../src/components/ConnectWallet");
const { default: i18n } = await import("../../src/i18n/i18n");

class MockEthereumProvider {
    public accounts = ["0x0000000000000000000000000000000000000001"];

    private chainId: string;
    private readonly listeners = new Set<(chainId: string) => void>();

    constructor(chainId: string) {
        this.chainId = chainId;
    }

    public request = (request: { method: string; params?: Array<unknown> }) => {
        switch (request.method) {
            case "eth_accounts":
            case "eth_requestAccounts":
                return this.accounts;

            case "eth_chainId":
                return this.chainId;

            case "wallet_switchEthereumChain": {
                const [{ chainId }] = request.params as [{ chainId: string }];
                this.emitChainChanged(chainId);
                return null;
            }

            default:
                return null;
        }
    };

    public on = (_event: "chainChanged", cb: (chainId: string) => void) => {
        this.listeners.add(cb);
    };

    public removeAllListeners = () => {
        this.listeners.clear();
    };

    public emitChainChanged = (chainId: string) => {
        this.chainId = chainId;
        for (const listener of this.listeners) {
            listener(chainId);
        }
    };
}

const wrapper = (props: { children: Element }) => {
    const App = () => (
        <GlobalProvider>
            <Web3SignerProvider>
                <CreateProvider>
                    <Router>
                        <Route path="/" component={() => props.children} />
                    </Router>
                </CreateProvider>
            </Web3SignerProvider>
        </GlobalProvider>
    );

    return (
        <Router root={App}>
            <Route path="/" component={() => props.children} />
        </Router>
    );
};

const Probe = () => {
    const { connectProvider, providers, signer } = useWeb3Signer();
    const { sendAmount, setSendAmount } = useCreateContext();
    const [chainId, setChainId] = createSignal("disconnected");
    const browserReady = createMemo(() => providers().browser !== undefined);

    createEffect(() => {
        const activeSigner = signer();
        if (activeSigner === undefined) {
            setChainId("disconnected");
            return;
        }

        void activeSigner.provider.getNetwork().then((network) => {
            setChainId(String(network.chainId));
        });
    });

    return (
        <>
            <button
                disabled={!browserReady()}
                onClick={() => void connectProvider("browser")}>
                connect provider
            </button>
            <button onClick={() => setSendAmount(BigNumber(123456))}>
                set amount
            </button>
            <div data-testid="send-amount">{sendAmount().toString()}</div>
            <div data-testid="chain-id">{chainId()}</div>
        </>
    );
};

describe("ConnectWallet", () => {
    let provider: MockEthereumProvider;

    beforeEach(() => {
        provider = new MockEthereumProvider("0x1");
        Object.defineProperty(window, "ethereum", {
            configurable: true,
            value: provider,
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "ethereum");
        vi.restoreAllMocks();
    });

    test("keeps the create amount when the EVM network changes", async () => {
        render(
            () => (
                <>
                    <Probe />
                    <ConnectWallet asset={RBTC} />
                </>
            ),
            { wrapper },
        );

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "connect provider" }),
            ).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole("button", { name: "set amount" }));
        expect(screen.getByTestId("send-amount").textContent).toBe("123456");

        fireEvent.click(
            screen.getByRole("button", { name: "connect provider" }),
        );

        expect(
            await screen.findByText(i18n.en.switch_network),
        ).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId("chain-id").textContent).toBe("1");
        });

        provider.emitChainChanged("0x21");

        await waitFor(() => {
            expect(screen.getByTestId("chain-id").textContent).toBe("33");
        });
        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: provider.accounts[0],
                }),
            ).toBeInTheDocument();
        });

        expect(
            screen.queryByText(i18n.en.switch_network),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("send-amount").textContent).toBe("123456");
    });
});
