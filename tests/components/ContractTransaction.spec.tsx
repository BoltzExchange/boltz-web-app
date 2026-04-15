import { Route, Router } from "@solidjs/router";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createMemo } from "solid-js";

vi.mock("ethers", () => {
    const stripPrefix = (value: string) =>
        value.startsWith("0x") ? value.slice(2) : value;
    const zeroPadValue = (value: string, length: number) =>
        `0x${stripPrefix(value).padStart(length * 2, "0")}`;
    const getBytes = (value: string) =>
        Uint8Array.from(Buffer.from(stripPrefix(value), "hex"));
    const concat = (values: string[]) =>
        `0x${values.map((value) => stripPrefix(value)).join("")}`;
    const solidityPacked = (types: string[], values: Array<string | bigint>) =>
        `0x${types
            .map((type, index) => {
                if (type.startsWith("uint")) {
                    const bytes = Number(type.slice(4)) / 8;
                    return BigInt(values[index] as bigint | number)
                        .toString(16)
                        .padStart(bytes * 2, "0");
                }

                if (type === "bytes32") {
                    return stripPrefix(
                        zeroPadValue(values[index] as string, 32),
                    );
                }

                throw new Error(`unsupported solidityPacked type: ${type}`);
            })
            .join("")}`;

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

    class Interface {
        public encodeFunctionData = vi.fn(() => "0xencoded");

        public encodeFilterTopics = vi.fn(() => []);

        public parseLog = vi.fn();
    }

    return {
        AbiCoder: {
            defaultAbiCoder: () => ({
                encode: vi.fn(() => "0xencoded"),
            }),
        },
        BrowserProvider: MockBrowserProvider,
        Contract: MockContract,
        FallbackProvider: MockFallbackProvider,
        Interface,
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
        ZeroAddress: "0x0000000000000000000000000000000000000000",
        concat,
        getBytes,
        solidityPacked,
        zeroPadValue,
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
const { config } = await import("../../src/config");
const { CreateProvider } = await import("../../src/context/Create");
const { GlobalProvider } = await import("../../src/context/Global");
const { Web3SignerProvider, useWeb3Signer } =
    await import("../../src/context/Web3");
const { default: ContractTransaction } =
    await import("../../src/components/ContractTransaction");

class MockEthereumProvider {
    public accounts: string[];

    private chainId: string;
    private readonly listeners = new Set<(chainId: string) => void>();

    constructor(chainId: string, accounts: string[]) {
        this.chainId = chainId;
        this.accounts = accounts;
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

const ConnectAndRender = (props: {
    address?: { address: string; derivationPath?: string };
}) => {
    const { connectProvider, providers } = useWeb3Signer();
    const browserReady = createMemo(() => providers().browser !== undefined);

    return (
        <>
            <button
                disabled={!browserReady()}
                onClick={() => void connectProvider("browser")}>
                connect provider
            </button>
            <ContractTransaction
                asset={RBTC}
                address={props.address}
                buttonText="Send"
                onClick={() => Promise.resolve()}
            />
        </>
    );
};

describe("ContractTransaction", () => {
    const rbtcChainId = `0x${config.assets.RBTC.network.chainId.toString(16)}`;

    afterEach(() => {
        Reflect.deleteProperty(window, "ethereum");
        vi.restoreAllMocks();
    });

    const setupProvider = (accounts: string[]) => {
        const provider = new MockEthereumProvider(rbtcChainId, accounts);
        Object.defineProperty(window, "ethereum", {
            configurable: true,
            value: provider,
        });
        return provider;
    };

    const connectWallet = async () => {
        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "connect provider" }),
            ).not.toBeDisabled();
        });
        fireEvent.click(
            screen.getByRole("button", { name: "connect provider" }),
        );
    };

    test("shows action button when wallet address matches with different casing", async () => {
        setupProvider(["0xabcdef0000000000000000000000000000000001"]);

        render(
            () => (
                <ConnectAndRender
                    address={{
                        address: "0xAbCdEf0000000000000000000000000000000001",
                    }}
                />
            ),
            { wrapper },
        );

        await connectWallet();

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Send" }),
            ).toBeInTheDocument();
        });
    });

    test("shows action button when wallet address matches exactly", async () => {
        const addr = "0xabcdef0000000000000000000000000000000001";
        setupProvider([addr]);

        render(() => <ConnectAndRender address={{ address: addr }} />, {
            wrapper,
        });

        await connectWallet();

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Send" }),
            ).toBeInTheDocument();
        });
    });

    test("shows connect fallback when addresses differ", async () => {
        setupProvider(["0xabcdef0000000000000000000000000000000001"]);

        render(
            () => (
                <ConnectAndRender
                    address={{
                        address: "0x9999990000000000000000000000000000000002",
                    }}
                />
            ),
            { wrapper },
        );

        await connectWallet();

        await waitFor(() => {
            expect(
                screen.queryByRole("button", { name: "Send" }),
            ).not.toBeInTheDocument();
        });
    });

    test("shows action button when no address constraint is set", async () => {
        setupProvider(["0xabcdef0000000000000000000000000000000001"]);

        render(() => <ConnectAndRender />, { wrapper });

        await connectWallet();

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Send" }),
            ).toBeInTheDocument();
        });
    });
});
