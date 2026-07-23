import { Route, Router } from "@solidjs/router";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { type JSX, createMemo, createSignal } from "solid-js";

import type { Signer } from "../../src/context/Web3";

vi.mock("../../packages/boltz-swaps/src/client.ts", async () => {
    const { config } = await import("../../src/config");

    return {
        getContracts: vi.fn().mockResolvedValue({
            rbtc: {
                network: {
                    chainId: config.assets!.RBTC.network!.chainId,
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

const wrapper = (props: { children: JSX.Element }) => {
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
    const rbtcChainId = `0x${config.assets!.RBTC.network!.chainId!.toString(16)}`;

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

    test("shows a loader instead of switch network while checking the signer network", async () => {
        let resolveChainId!: (chainId: number) => void;
        const chainId = new Promise<number>((resolve) => {
            resolveChainId = resolve;
        });
        const [signerOverride] = createSignal({
            address: "0xabcdef0000000000000000000000000000000001",
            provider: {
                getChainId: () => chainId,
            },
        } as unknown as Signer);

        render(
            () => (
                <ContractTransaction
                    asset={RBTC}
                    signerOverride={signerOverride}
                    buttonText="Send"
                    onClick={() => Promise.resolve()}
                />
            ),
            { wrapper },
        );

        expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /switch network/i }),
        ).toBeNull();

        resolveChainId(config.assets!.RBTC.network!.chainId!);

        expect(
            await screen.findByRole("button", { name: "Send" }),
        ).toBeInTheDocument();
    });

    test("shows a retry action instead of switch network when the network check fails", async () => {
        const getChainId = vi
            .fn()
            .mockRejectedValueOnce(new Error("could not read chain ID"))
            .mockResolvedValue(config.assets!.RBTC.network!.chainId!);
        const [signerOverride] = createSignal({
            address: "0xabcdef0000000000000000000000000000000001",
            provider: { getChainId },
        } as unknown as Signer);

        render(
            () => (
                <ContractTransaction
                    asset={RBTC}
                    signerOverride={signerOverride}
                    buttonText="Send"
                    onClick={() => Promise.resolve()}
                />
            ),
            { wrapper },
        );

        expect(
            await screen.findByText("could not read chain ID"),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /switch network/i }),
        ).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Retry" }));

        expect(
            await screen.findByRole("button", { name: "Send" }),
        ).toBeInTheDocument();
    });
});
