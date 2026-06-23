import { useNavigate } from "@solidjs/router";
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { type BridgeDriver, bridgeRegistry } from "boltz-swaps/bridge";
import type { Pairs } from "boltz-swaps/client";
import {
    BridgeKind,
    NetworkTransport,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import { Show, createSignal, onMount } from "solid-js";

import { config as runtimeConfig } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { BTC, LBTC, LN, RBTC, TBTC, USDT0 } from "../../src/consts/Assets";
import { Denomination, Side } from "../../src/consts/Enums";
import * as web3Context from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";
import Create from "../../src/pages/Create";
import Pair from "../../src/utils/Pair";
import { calculateReceiveAmount } from "../../src/utils/calculate";
import * as connectedMaximum from "../../src/utils/connectedMaximum";
import type * as HelperModule from "../../src/utils/helper";
import { isMobile } from "../../src/utils/helper";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs } from "../pairs";

const originalAssets = structuredClone(runtimeConfig.assets ?? {});

beforeAll(() => {
    runtimeConfig.assets = {
        ...runtimeConfig.assets,
        "USDT0-SOL": structuredClone(mainnetConfig.assets!["USDT0-SOL"]),
        "USDT0-POL": structuredClone(mainnetConfig.assets!["USDT0-POL"]),
    };
});

afterAll(() => {
    runtimeConfig.assets = originalAssets;
});

vi.mock("../../packages/boltz-swaps/src/client.ts", () => ({
    getPairs: vi.fn(() => Promise.resolve(pairs)),
}));
vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <div data-testid="connect-wallet" />,
}));
vi.mock("qr-scanner", () => ({
    default: { hasCamera: vi.fn(() => Promise.resolve(true)) },
}));
vi.mock("../../src/utils/helper", async (importActual) => ({
    ...(await importActual<typeof HelperModule>()),
    isMobile: vi.fn(() => false),
}));

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

const invoice =
    "lnbcrt600u1p5ynhmgpp5l8j7lnaql4mqeukvcqmhr8zp9vh3rngfgmla6km2fh9vf8pt678sdqqcqzzsxqrpwusp56gha98s9xk2f4eeyhs7dcsx4j4rt79llks72nf6l6hc9cna6vfgs9qxpqysgqqnt8lqcrujmuuv3ajvrlu5z7ydvvge4efv39hj28etf8v72vpcl597evz5e0tvq04tv3z089wxtugee4xh5hvu6309ymrfddrlzfhzgqumsrpk";
const lnurl =
    "lnurl1dp68gurn8ghj7mrww4exctndd93ksct9dscnqvf39eshgtmpwp5j7mrww4excuqgy84zh";
const bolt12Offer =
    "lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c";

const flushQuoteDebounce = async () => {
    await vi.runOnlyPendingTimersAsync();
};

const testEvmAddress = "0x1000000000000000000000000000000000000000";
const commitmentSourceAsset = "USDT0-POL";
const commitmentRoute = {
    sourceAsset: commitmentSourceAsset,
    destinationAsset: USDT0,
};
const commitmentRouteDetail = {
    ...commitmentRoute,
    kind: BridgeKind.Oft,
    position: SwapPosition.Pre,
};
const directEvmSubmarinePairs: Pairs = {
    submarine: {
        [RBTC]: {
            [BTC]: {
                hash: "rbtc-ln-pair-hash",
                rate: 1,
                limits: {
                    maximal: 1_000_000,
                    minimal: 1,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0,
                    minerFees: 0,
                },
            },
        },
    },
    reverse: {},
    chain: {},
};
const commitmentSubmarinePairs: Pairs = {
    submarine: {
        [TBTC]: {
            [BTC]: {
                hash: "tbtc-ln-pair-hash",
                rate: 1,
                limits: {
                    maximal: 1_000_000,
                    minimal: 1,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0,
                    minerFees: 0,
                },
            },
        },
    },
    reverse: {},
    chain: {},
};

const renderCreate = () =>
    render(
        () => (
            <>
                <TestComponent />
                <Create />
            </>
        ),
        {
            wrapper: contextWrapper,
        },
    );

const mockWalletConnectEvm = () =>
    vi.spyOn(web3Context, "useWeb3Signer").mockReturnValue({
        signer: () => undefined,
        connectedWallet: () => ({
            address: testEvmAddress,
            rdns: "wallet-connect",
            transport: NetworkTransport.Evm,
        }),
        providers: () => ({}),
        getEtherSwap: vi.fn(),
        getErc20Swap: vi.fn(),
        getGasAbstractionSigner: vi.fn(),
    } as unknown as ReturnType<typeof web3Context.useWeb3Signer>);

const createCommitmentPair = () => {
    const currentPair = new Pair(
        commitmentSubmarinePairs,
        commitmentSourceAsset,
        LN,
        commitmentSubmarinePairs,
    );
    currentPair.getMinimum = vi.fn().mockResolvedValue(1);
    currentPair.getMaximum = vi.fn().mockResolvedValue(1_000_000);
    currentPair.calculateReceiveAmount = vi
        .fn()
        .mockResolvedValue(BigNumber(0));
    currentPair.creationData = vi.fn().mockResolvedValue({
        type: SwapType.Submarine,
        from: TBTC,
        to: BTC,
        sendAmount: BigNumber(740_000),
        receiveAmount: BigNumber(99_000),
        pairHash: "tbtc-ln-pair-hash",
        hops: [
            {
                type: SwapType.Dex,
                from: USDT0,
                to: TBTC,
            },
        ],
        hopsPosition: SwapPosition.Pre,
    });

    return currentPair;
};

const mockPreBridgeDriver = (driver: Partial<BridgeDriver>) => ({
    getPreRoute: vi
        .spyOn(bridgeRegistry, "getPreRoute")
        .mockImplementation((asset) =>
            asset === commitmentSourceAsset ? commitmentRoute : undefined,
        ),
    requireDriverForRoute: vi
        .spyOn(bridgeRegistry, "requireDriverForRoute")
        .mockReturnValue(driver as BridgeDriver),
    getDriverForAsset: vi
        .spyOn(bridgeRegistry, "getDriverForAsset")
        .mockImplementation((asset) =>
            asset === commitmentSourceAsset
                ? (driver as BridgeDriver)
                : undefined,
        ),
});

const createPreBridgeDriver = (
    getSourceTokenBalance: BridgeDriver["getSourceTokenBalance"],
): Partial<BridgeDriver> => ({
    getTransport: () => NetworkTransport.Evm,
    getSourceTokenBalance,
    getPreRoute: () => commitmentRoute,
    getRoutePosition: () => commitmentRouteDetail,
    getMessagingFeeToken: () => "POL",
    getTransferFeeAsset: () => commitmentRoute.sourceAsset,
});

const selectMaximumCommitmentSwap = async ({
    createSwap = true,
}: { createSwap?: boolean } = {}) => {
    window.history.pushState({}, "", "/");
    const currentPair = createCommitmentPair();
    renderCreate();
    await globalSignals.clearSwaps();
    globalSignals.setOnline(true);
    globalSignals.setPairs(commitmentSubmarinePairs);
    globalSignals.setRegularPairs(commitmentSubmarinePairs);
    signals.setPair(currentPair);

    await waitFor(() => {
        expect(signals.maximum()).toBe(1_000_000);
    });

    fireEvent.click(await screen.findByTestId("limit-max-button"));

    await waitFor(() => {
        expect(signals.sendAmount().toNumber()).toBe(1_000_000);
        expect(signals.amountValid()).toBe(false);
        expect(signals.receiveAmount().isZero()).toBe(true);
    });

    let createButton!: HTMLButtonElement;
    await waitFor(() => {
        const buttons = screen.getAllByTestId(
            "create-swap-button",
        ) as HTMLButtonElement[];
        expect(buttons).toHaveLength(1);
        createButton = buttons[0];

        expect(signals.valid()).toBe(false);
        expect(createButton.disabled).toBe(false);
        expect(createButton.textContent).toBe(i18n.en.create_swap);
        const invoiceInput = screen.getByTestId("invoice") as HTMLInputElement;
        expect(invoiceInput).toBeDisabled();
        expect(invoiceInput.placeholder).toBe(
            i18n.en.commitment_invoice_deferred,
        );
        expect(screen.getByTestId("committed-invoice-row")).toBeInTheDocument();
        expect(screen.getByTestId("committed-invoice-clear")).toHaveTextContent(
            i18n.en.clear_amount,
        );
        expect(screen.queryByTestId("deferred-destination-summary")).toBeNull();

        expect(
            Array.from(
                document.body.querySelectorAll(
                    '[data-testid="connect-wallet"], [data-testid="create-swap-button"]',
                ),
            ).map((node) => node.getAttribute("data-testid")),
        ).toEqual(["connect-wallet", "create-swap-button"]);
    });

    if (createSwap) {
        fireEvent.click(createButton);
    }
};

const assertCommitmentSwapCreated = async () => {
    await waitFor(async () => {
        const [swap] = await globalSignals.getSwaps();
        expect(swap).toMatchObject({
            type: SwapType.Commitment,
            assetSend: TBTC,
            assetReceive: BTC,
            initialReceiveAsset: LN,
            sourceAsset: commitmentSourceAsset,
            sourceAmount: "1000000",
            lockupAmount: "740000",
            pairHash: "tbtc-ln-pair-hash",
            commitmentLockup: true,
            bridge: {
                sourceAsset: commitmentSourceAsset,
                destinationAsset: USDT0,
                position: SwapPosition.Pre,
                sourceAmount: "1000000",
            },
            dex: {
                position: SwapPosition.Pre,
                sourceAmount: "1000000",
                quoteAmount: "1000000",
            },
        });
        expect(swap).not.toHaveProperty("sendAmount");
        expect(swap).not.toHaveProperty("receiveAmount");
    });
};

describe("Create", () => {
    test("should apply asset url params when Create mounts after navigation", async () => {
        const NavigateToCreate = () => {
            const navigate = useNavigate();
            const [showCreate, setShowCreate] = createSignal(false);

            onMount(() => {
                navigate(`/?sendAsset=${LBTC}&receiveAsset=${LN}`);
                setShowCreate(true);
            });

            return (
                <>
                    <TestComponent />
                    <Show when={showCreate()}>
                        <Create />
                    </Show>
                </>
            );
        };

        render(() => <NavigateToCreate />, {
            wrapper: contextWrapper,
        });

        await waitFor(() => {
            expect(signals.pair().fromAsset).toEqual(LBTC);
            expect(signals.pair().toAsset).toEqual(LN);
        });
        expect(window.location.search).toEqual("");

        window.history.replaceState({}, "", "/");
    });

    test("should preserve toAsset when only sendAsset is in URL", async () => {
        let initialToAsset: string | undefined;

        const NavigateToCreate = () => {
            const navigate = useNavigate();
            const [showCreate, setShowCreate] = createSignal(false);

            onMount(() => {
                initialToAsset = signals.pair().toAsset;
                navigate(`/?sendAsset=${LBTC}`);
                setShowCreate(true);
            });

            return (
                <>
                    <TestComponent />
                    <Show when={showCreate()}>
                        <Create />
                    </Show>
                </>
            );
        };

        render(() => <NavigateToCreate />, {
            wrapper: contextWrapper,
        });

        await waitFor(() => {
            expect(signals.pair().fromAsset).toEqual(LBTC);
        });
        expect(signals.pair().toAsset).toEqual(initialToAsset);
        expect(window.location.search).toEqual("");

        window.history.replaceState({}, "", "/");
    });

    test("should preserve fromAsset when only receiveAsset is in URL", async () => {
        let initialFromAsset: string | undefined;

        const NavigateToCreate = () => {
            const navigate = useNavigate();
            const [showCreate, setShowCreate] = createSignal(false);

            onMount(() => {
                initialFromAsset = signals.pair().fromAsset;
                navigate(`/?receiveAsset=${LBTC}`);
                setShowCreate(true);
            });

            return (
                <>
                    <TestComponent />
                    <Show when={showCreate()}>
                        <Create />
                    </Show>
                </>
            );
        };

        render(() => <NavigateToCreate />, {
            wrapper: contextWrapper,
        });

        await waitFor(() => {
            expect(signals.pair().toAsset).toEqual(LBTC);
        });
        expect(signals.pair().fromAsset).toEqual(initialFromAsset);
        expect(window.location.search).toEqual("");

        window.history.replaceState({}, "", "/");
    });

    test("should render Create", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        const button = await screen.findAllByText(i18n.en.create_swap);
        expect(button).not.toBeUndefined();
    });

    test("should hide wallet section for non-EVM pairs", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(BTC, LN);

        await waitFor(() => {
            expect(
                screen.queryByTestId("connect-wallet"),
            ).not.toBeInTheDocument();
        });
    });

    test("should show wallet section for EVM pairs", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(BTC, RBTC);

        expect(await screen.findByTestId("connect-wallet")).toBeInTheDocument();
    });

    test("should show wallet section for non-EVM wallet pairs", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(BTC, "USDT0-SOL");

        expect(await screen.findByTestId("connect-wallet")).toBeInTheDocument();
    });

    test("should show only one destination address input for wallet-connectable non-EVM pairs", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(BTC, "USDT0-SOL");

        await screen.findByTestId("connect-wallet");
        expect(screen.getAllByTestId("onchainAddress")).toHaveLength(1);
    });

    test("should show WASM error", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setWasmSupported(false);
        expect(
            await screen.findAllByText(i18n.en.error_wasm),
        ).not.toBeUndefined();
    });

    test("should show the create button spinner while recalculating network quotes", async () => {
        vi.useFakeTimers();

        try {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            globalSignals.setPairs(pairs);
            globalSignals.setRegularPairs(pairs);

            const currentPair = new Pair(pairs, LN, BTC, pairs);
            signals.setPair(currentPair);
            let resolveQuote: ((amount: BigNumber) => void) | undefined;
            const quotePromise = new Promise<BigNumber>((resolve) => {
                resolveQuote = resolve;
            });

            Object.defineProperty(currentPair, "needsNetworkForQuote", {
                configurable: true,
                get: () => true,
            });
            currentPair.calculateReceiveAmount = vi
                .fn(() => quotePromise)
                .mockName("calculateReceiveAmount");
            const button = await screen.findByTestId("create-swap-button");

            fireEvent.input(await screen.findByTestId("sendAmount"), {
                target: { value: "100000" },
            });

            expect(
                within(button).getByTestId("loading-spinner"),
            ).toBeInTheDocument();

            await flushQuoteDebounce();

            await waitFor(() => {
                expect(currentPair.calculateReceiveAmount).toHaveBeenCalled();
            });

            expect(
                within(button).getByTestId("loading-spinner"),
            ).toBeInTheDocument();

            resolveQuote?.(BigNumber(90000));

            await waitFor(() => {
                expect(
                    within(button).queryByTestId("loading-spinner"),
                ).not.toBeInTheDocument();
            });
        } finally {
            vi.useRealTimers();
        }
    });

    test("should forward the destination address to receive quote calculations", async () => {
        vi.useFakeTimers();

        try {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            const currentPair = signals.pair();
            Object.defineProperty(currentPair, "needsNetworkForQuote", {
                configurable: true,
                get: () => true,
            });
            currentPair.calculateReceiveAmount = vi
                .fn(() => Promise.resolve(BigNumber(90_000)))
                .mockName("calculateReceiveAmount");

            signals.setOnchainAddress(
                "0x5000000000000000000000000000000000000000",
            );

            fireEvent.input(await screen.findByTestId("sendAmount"), {
                target: { value: "100000" },
            });

            await flushQuoteDebounce();

            await waitFor(() => {
                expect(currentPair.calculateReceiveAmount).toHaveBeenCalled();
            });

            const latestCall = vi
                .mocked(currentPair.calculateReceiveAmount)
                .mock.calls.at(-1);
            expect(latestCall).toBeDefined();
            expect(latestCall?.[0]?.toString()).toBe("100000");
            expect(latestCall?.[1]).toBe(signals.minerFee());
            expect(latestCall?.[2]).toBeUndefined();
            expect(latestCall?.[3]).toBe(signals.getGasToken());
            expect(latestCall?.[4]).toBe(
                "0x5000000000000000000000000000000000000000",
            );
        } finally {
            vi.useRealTimers();
        }
    });

    test("should re-fetch receive quote when the destination address changes", async () => {
        vi.useFakeTimers();

        try {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            const currentPair = signals.pair();
            Object.defineProperty(currentPair, "needsNetworkForQuote", {
                configurable: true,
                get: () => true,
            });
            currentPair.calculateReceiveAmount = vi
                .fn(() => Promise.resolve(BigNumber(90_000)))
                .mockName("calculateReceiveAmount");

            signals.setAddressValid(true);
            signals.setOnchainAddress(
                "0x5000000000000000000000000000000000000000",
            );

            fireEvent.input(await screen.findByTestId("sendAmount"), {
                target: { value: "100000" },
            });

            await flushQuoteDebounce();

            await waitFor(() => {
                expect(
                    currentPair.calculateReceiveAmount,
                ).toHaveBeenCalledTimes(1);
            });

            signals.setOnchainAddress(
                "0x6000000000000000000000000000000000000000",
            );

            await flushQuoteDebounce();

            await waitFor(() => {
                expect(
                    currentPair.calculateReceiveAmount,
                ).toHaveBeenCalledTimes(2);
            });

            const latestCall = vi
                .mocked(currentPair.calculateReceiveAmount)
                .mock.calls.at(-1);
            expect(latestCall?.[4]).toBe(
                "0x6000000000000000000000000000000000000000",
            );
        } finally {
            vi.useRealTimers();
        }
    });

    test.each([
        {
            side: "send",
            inputTestId: "sendAmount",
            quoteMethod: "calculateReceiveAmount",
            counterAmount: 90_000,
        },
        {
            side: "receive",
            inputTestId: "receiveAmount",
            quoteMethod: "calculateSendAmount",
            counterAmount: 110_000,
        },
    ] as const)(
        "should preserve the typed $side amount when destination changes during a pending quote",
        async ({ inputTestId, quoteMethod, counterAmount }) => {
            vi.useFakeTimers();

            try {
                render(
                    () => (
                        <>
                            <TestComponent />
                            <Create />
                        </>
                    ),
                    {
                        wrapper: contextWrapper,
                    },
                );

                setPairAssets(LN, BTC);

                const currentPair = signals.pair();
                let resolveFirstQuote:
                    | ((amount: BigNumber) => void)
                    | undefined;
                const firstQuote = new Promise<BigNumber>((resolve) => {
                    resolveFirstQuote = resolve;
                });

                Object.defineProperty(currentPair, "needsNetworkForQuote", {
                    configurable: true,
                    get: () => true,
                });
                currentPair[quoteMethod] = vi
                    .fn()
                    .mockImplementationOnce(() => firstQuote)
                    .mockImplementation(() =>
                        Promise.resolve(BigNumber(counterAmount)),
                    )
                    .mockName(quoteMethod);

                fireEvent.input(await screen.findByTestId(inputTestId), {
                    target: { value: "100000" },
                });

                await flushQuoteDebounce();

                await waitFor(() => {
                    expect(currentPair[quoteMethod]).toHaveBeenCalledTimes(1);
                });

                fireEvent.input(await screen.findByTestId("onchainAddress"), {
                    target: {
                        value: "bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm",
                    },
                });

                await flushQuoteDebounce();

                await waitFor(() => {
                    expect(currentPair[quoteMethod]).toHaveBeenCalledTimes(2);
                });

                const latestCall = vi
                    .mocked(currentPair[quoteMethod])
                    .mock.calls.at(-1);
                expect(latestCall?.[0]?.toString()).toBe("100000");

                resolveFirstQuote?.(BigNumber(counterAmount));
            } finally {
                vi.useRealTimers();
            }
        },
    );

    test("should block creation when a routed quote resolves to zero", async () => {
        vi.useFakeTimers();

        try {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            globalSignals.setOnline(true);
            globalSignals.setPairs(pairs);
            setPairAssets("USDT0-SOL", BTC);

            const currentPair = signals.pair();
            Object.defineProperty(currentPair, "needsNetworkForQuote", {
                configurable: true,
                get: () => true,
            });
            currentPair.calculateReceiveAmount = vi
                .fn(() => Promise.resolve(BigNumber(0)))
                .mockName("calculateReceiveAmount");

            signals.setAddressValid(true);
            signals.setOnchainAddress(
                "bcrt1q7vq47xpsg4t080205edaulc3sdsjpdxy9svhr3",
            );

            fireEvent.input(await screen.findByTestId("sendAmount"), {
                target: { value: "100000" },
            });

            await flushQuoteDebounce();

            await waitFor(() => {
                expect(currentPair.calculateReceiveAmount).toHaveBeenCalled();
            });

            const button = (await screen.findByTestId(
                "create-swap-button",
            )) as HTMLButtonElement;

            vi.useRealTimers();

            await waitFor(() => {
                expect(signals.amountValid()).toBe(false);
                expect(button.disabled).toBe(true);
                expect(button.textContent).toBe(i18n.en.error_zero_quote);
            });
        } finally {
            vi.useRealTimers();
        }
    });

    test("should update receive amount on asset change", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(LN, BTC);
        signals.setSendAmount(BigNumber(50_000));

        // To force trigger a recalculation
        setPairAssets(LN, LBTC);
        setPairAssets(LN, BTC);

        await waitFor(() => {
            expect(signals.receiveAmount()).toEqual(BigNumber(38110));
        });

        setPairAssets(LN, LBTC);
        const expectedReceiveAmount = await signals
            .pair()
            .calculateReceiveAmount(BigNumber(50_000), signals.minerFee());

        await waitFor(() => {
            expect(signals.receiveAmount()).toEqual(expectedReceiveAmount);
        });
    });

    test("should update receive amount on miner fee change", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(LN, BTC);
        signals.setSendAmount(BigNumber(50_000));

        // // To force trigger a recalculation
        setPairAssets(LN, LBTC);
        setPairAssets(LN, BTC);

        await waitFor(() => {
            expect(signals.receiveAmount()).toEqual(BigNumber(38110));
        });

        const updatedCfg = structuredClone(pairs);
        updatedCfg.reverse[BTC][BTC].fees.minerFees.claim += 1;
        globalSignals.setPairs(updatedCfg);

        await waitFor(() => {
            expect(signals.receiveAmount()).toEqual(BigNumber(38110 - 1));
        });
    });

    test("should update calculated value on fee change", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        signals.setMinimum(pairs.reverse[BTC][BTC].limits.minimal);
        setPairAssets(LN, BTC);

        const updateConfig = () => {
            const updatedCfg = structuredClone(pairs);
            updatedCfg.reverse[BTC][BTC].fees.minerFees.claim += 1;
            globalSignals.setPairs(updatedCfg);
        };

        const amount = 100_000;
        fireEvent.input(await screen.findByTestId("receiveAmount"), {
            target: { value: amount },
        });

        await waitFor(() => {
            expect(signals.amountChanged()).toEqual(Side.Receive);
            expect(signals.sendAmount()).toEqual(BigNumber(112202));
            expect(signals.receiveAmount()).toEqual(BigNumber(amount));
        });

        updateConfig();

        await waitFor(() => {
            expect(signals.sendAmount()).toEqual(BigNumber(112203));
            expect(signals.receiveAmount()).toEqual(BigNumber(amount));
        });

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: amount },
        });

        await waitFor(() => {
            expect(signals.amountChanged()).toEqual(Side.Send);
            expect(signals.sendAmount()).toEqual(BigNumber(amount));
            expect(signals.receiveAmount()).toEqual(BigNumber(87859));
        });

        updateConfig();

        await waitFor(() => {
            expect(signals.sendAmount()).toEqual(BigNumber(amount));
            expect(signals.receiveAmount()).toEqual(BigNumber(87859));
        });
    });

    test("should set max amount on click", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);

        const amount = signals.maximum();

        fireEvent.click(await screen.findByTestId("limit-max-button"));

        expect(signals.sendAmount()).toEqual(BigNumber(amount));
        expect(signals.receiveAmount()).toEqual(
            calculateReceiveAmount(
                BigNumber(amount),
                signals.boltzFee(),
                signals.minerFee(),
                SwapType.Reverse,
            ),
        );
    });

    test("should use the swap maximum when connected wallet maximum is zero", async () => {
        const getConnectedMaximum = vi
            .spyOn(connectedMaximum, "getConnectedMaximum")
            .mockResolvedValue(BigNumber(0));

        try {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            globalSignals.setPairs(pairs);

            await waitFor(() => {
                expect(signals.maximum()).toBeGreaterThan(0);
            });
            const amount = signals.maximum();

            fireEvent.click(await screen.findByTestId("limit-max-button"));

            await waitFor(() => {
                expect(signals.sendAmount()).toEqual(BigNumber(amount));
            });
            expect(getConnectedMaximum).toHaveBeenCalled();
        } finally {
            getConnectedMaximum.mockRestore();
        }
    });

    test("should update the loading target when selecting max", async () => {
        vi.useFakeTimers();

        try {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            globalSignals.setPairs(pairs);

            await waitFor(() => {
                expect(signals.minimum()).toBeGreaterThan(0);
            });

            const currentPair = signals.pair();
            Object.defineProperty(currentPair, "needsNetworkForQuote", {
                configurable: true,
                get: () => true,
            });
            currentPair.calculateReceiveAmount = vi
                .fn(() => new Promise<BigNumber>(() => undefined))
                .mockName("calculateReceiveAmount");

            signals.setAmountChanged(Side.Receive);

            const receiveAmountInput = (await screen.findByTestId(
                "receiveAmount",
            )) as HTMLInputElement;
            const sendAmountInput = (await screen.findByTestId(
                "sendAmount",
            )) as HTMLInputElement;
            fireEvent.click(screen.getByTestId("limit-max-button"));
            await Promise.resolve();

            expect(signals.amountChanged()).toEqual(Side.Send);
            expect(sendAmountInput.disabled).toEqual(false);
            expect(receiveAmountInput.disabled).toEqual(true);
        } finally {
            vi.clearAllTimers();
            vi.useRealTimers();
        }
    });

    test("should prioritize amount errors", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setPairs(pairs);
        setPairAssets(LN, BTC);
        await waitFor(() => {
            expect(signals.minimum()).toBeGreaterThan(0);
        });

        const sendAmountInput = await screen.findByTestId("sendAmount");
        fireEvent.input(sendAmountInput, {
            target: {
                value: `${pairs.reverse["BTC"]["BTC"].limits.minimal}`,
            },
        });

        const addressButton = await screen.findByTestId("onchainAddress");
        fireEvent.input(addressButton, {
            target: {
                value: "invalid address",
            },
        });

        const createButton = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;
        globalSignals.setOnline(true);

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toEqual("Invalid BTC address");
        });

        fireEvent.input(sendAmountInput, {
            target: {
                value: "1",
            },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toEqual(i18n.en.error_zero_quote);
        });
    });

    test.each`
        fromAsset | toAsset | description
        ${LN}     | ${BTC}  | ${"reverse swap to BTC"}
        ${LN}     | ${LBTC} | ${"reverse swap to LBTC"}
        ${BTC}    | ${LN}   | ${"submarine swap from BTC"}
        ${LBTC}   | ${LN}   | ${"submarine swap from LBTC"}
    `(
        "should show minimum amount error (not address/invoice) on initial page load for $description",
        async ({ fromAsset, toAsset }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            globalSignals.setOnline(true);
            globalSignals.setPairs(pairs);
            setPairAssets(fromAsset, toAsset);

            await waitFor(() => {
                expect(signals.minimum()).toBeGreaterThan(0);
            });

            const createButton = (await screen.findByTestId(
                "create-swap-button",
            )) as HTMLButtonElement;

            await waitFor(() => {
                expect(createButton.disabled).toEqual(true);
                expect(createButton.textContent).toMatch(/^Minimum amount is /);
            });
            if (toAsset === LN) {
                expect(screen.getByTestId("invoice")).toBeInTheDocument();
            }
        },
    );

    test("should re-prioritize the minimum amount error after clearing the send amount (reverse swap)", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setOnline(true);
        globalSignals.setPairs(pairs);
        setPairAssets(LN, BTC);
        await waitFor(() => {
            expect(signals.minimum()).toBeGreaterThan(0);
        });

        const createButton = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;
        const sendAmountInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;

        await waitFor(() => {
            expect(createButton.textContent).toMatch(/^Minimum amount is /);
        });

        fireEvent.input(sendAmountInput, {
            target: {
                value: `${pairs.reverse[BTC][BTC].limits.minimal}`,
            },
        });

        await waitFor(() => {
            expect(createButton.textContent).toEqual(
                i18n.en.invalid_address.replace("{{ asset }}", BTC),
            );
        });

        fireEvent.input(sendAmountInput, {
            target: { value: "" },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toMatch(/^Minimum amount is /);
        });
    });

    test("should keep the invoice input while submarine swap is missing an invoice", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setOnline(true);
        globalSignals.setPairs(pairs);
        setPairAssets(BTC, LN);
        await waitFor(() => {
            expect(signals.minimum()).toBeGreaterThan(0);
        });

        const sendAmountInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;
        const createButton = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;

        expect(await screen.findByTestId("invoice")).toBeInTheDocument();
        expect(createButton.textContent).toMatch(/^Minimum amount is /);

        fireEvent.input(sendAmountInput, {
            target: {
                value: `${signals.minimum()}`,
            },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toEqual(i18n.en.invalid_invoice);
            expect(screen.getByTestId("invoice")).toBeInTheDocument();
        });

        fireEvent.input(sendAmountInput, {
            target: { value: "" },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toMatch(/^Minimum amount is /);
            expect(screen.getByTestId("invoice")).toBeInTheDocument();
        });
    });

    test("should explain when changing the amount clears a fixed invoice", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setOnline(true);
        globalSignals.setPairs(pairs);
        setPairAssets(BTC, LN);
        await waitFor(() => {
            expect(signals.minimum()).toBeGreaterThan(0);
        });

        signals.setInvoice(invoice);
        signals.setInvoiceValid(true);

        fireEvent.input(await screen.findByTestId("sendAmount"), {
            target: { value: `${signals.minimum()}` },
        });

        await waitFor(() => {
            expect(signals.invoice()).toBe("");
            expect(globalSignals.notification()).toBe(
                i18n.en.invoice_cleared_amount_changed,
            );
            expect(globalSignals.notificationType()).toBe("success");
        });
    });

    test.each`
        type        | destination    | lnurlValue | bolt12Value
        ${"LNURL"}  | ${lnurl}       | ${lnurl}   | ${undefined}
        ${"BOLT12"} | ${bolt12Offer} | ${""}      | ${bolt12Offer}
    `(
        "should keep a $type destination when changing the send amount",
        async ({ destination, lnurlValue, bolt12Value }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            globalSignals.setOnline(true);
            globalSignals.setPairs(pairs);
            setPairAssets(BTC, LN);
            await waitFor(() => {
                expect(signals.minimum()).toBeGreaterThan(0);
            });

            signals.setInvoice(destination);
            signals.setLnurl(lnurlValue);
            signals.setBolt12Offer(bolt12Value);
            signals.setInvoiceValid(false);
            signals.setInvoiceError(undefined);

            fireEvent.input(await screen.findByTestId("sendAmount"), {
                target: { value: `${signals.minimum()}` },
            });

            await waitFor(() => {
                expect(signals.invoice()).toBe(destination);
                expect(signals.lnurl()).toBe(lnurlValue);
                expect(signals.bolt12Offer()).toBe(bolt12Value);
                expect(screen.getByTestId("invoice")).toHaveValue(destination);
            });
        },
    );

    test.each`
        type        | destination    | lnurlValue | bolt12Value
        ${"LNURL"}  | ${lnurl}       | ${lnurl}   | ${undefined}
        ${"BOLT12"} | ${bolt12Offer} | ${""}      | ${bolt12Offer}
    `(
        "should keep a $type destination editable after selecting max for a commitment swap",
        async ({ destination, lnurlValue, bolt12Value }) => {
            const bridgeMocks = mockPreBridgeDriver(
                createPreBridgeDriver(
                    vi
                        .fn<BridgeDriver["getSourceTokenBalance"]>()
                        .mockResolvedValue(1_000_000n),
                ),
            );
            const useWeb3Signer = mockWalletConnectEvm();

            try {
                window.history.pushState({}, "", "/");
                const currentPair = createCommitmentPair();
                renderCreate();
                await globalSignals.clearSwaps();
                globalSignals.setOnline(true);
                globalSignals.setPairs(commitmentSubmarinePairs);
                globalSignals.setRegularPairs(commitmentSubmarinePairs);
                signals.setPair(currentPair);

                await waitFor(() => {
                    expect(signals.maximum()).toBe(1_000_000);
                });

                signals.setInvoice(destination);
                signals.setLnurl(lnurlValue);
                signals.setBolt12Offer(bolt12Value);
                signals.setInvoiceValid(false);
                signals.setInvoiceError(undefined);

                fireEvent.click(await screen.findByTestId("limit-max-button"));

                await waitFor(() => {
                    const invoiceInput = screen.getByTestId(
                        "invoice",
                    ) as HTMLInputElement;
                    expect(signals.sendAmount().toNumber()).toBe(1_000_000);
                    expect(signals.invoice()).toBe(destination);
                    expect(signals.lnurl()).toBe(lnurlValue);
                    expect(signals.bolt12Offer()).toBe(bolt12Value);
                    expect(invoiceInput).toHaveValue(destination);
                    expect(invoiceInput).not.toBeDisabled();
                    expect(screen.queryByTestId("committed-invoice-row")).toBe(
                        null,
                    );
                    expect(
                        screen.queryByTestId("deferred-destination-summary"),
                    ).toBeNull();
                });

                const editedDestination = "not-a-lightning-destination";
                fireEvent.input(screen.getByTestId("invoice"), {
                    target: { value: editedDestination },
                });

                await waitFor(() => {
                    const invoiceInput = screen.getByTestId(
                        "invoice",
                    ) as HTMLInputElement;
                    expect(signals.invoice()).toBe(editedDestination);
                    expect(signals.sendAmount().isZero()).toBe(true);
                    expect(signals.receiveAmount().isZero()).toBe(true);
                    expect(signals.amountValid()).toBe(false);
                    expect(invoiceInput).not.toBeDisabled();
                    expect(screen.queryByTestId("committed-invoice-row")).toBe(
                        null,
                    );
                });
            } finally {
                useWeb3Signer.mockRestore();
                bridgeMocks.getPreRoute.mockRestore();
                bridgeMocks.requireDriverForRoute.mockRestore();
                bridgeMocks.getDriverForAsset.mockRestore();
                window.history.pushState({}, "", "/");
            }
        },
    );

    test("should require an invoice for direct max EVM submarine swaps", async () => {
        const useWeb3Signer = mockWalletConnectEvm();

        try {
            window.history.pushState({}, "", "/");
            renderCreate();
            await globalSignals.clearSwaps();
            globalSignals.setOnline(true);
            globalSignals.setPairs(directEvmSubmarinePairs);
            globalSignals.setRegularPairs(directEvmSubmarinePairs);
            signals.setPair(
                new Pair(
                    directEvmSubmarinePairs,
                    RBTC,
                    LN,
                    directEvmSubmarinePairs,
                ),
            );

            await waitFor(() => {
                expect(signals.maximum()).toBe(1_000_000);
            });

            fireEvent.click(await screen.findByTestId("limit-max-button"));

            await waitFor(() => {
                expect(signals.sendAmount().toNumber()).toBe(signals.maximum());
            });

            await waitFor(() => {
                expect(signals.valid()).toBe(false);
                const createButton = screen.getByTestId(
                    "create-swap-button",
                ) as HTMLButtonElement;
                expect(createButton.disabled).toBe(true);
                expect(createButton.textContent).toEqual(
                    i18n.en.invalid_invoice,
                );
                expect(screen.getByTestId("invoice")).toBeInTheDocument();
            });

            await expect(globalSignals.getSwaps()).resolves.toEqual([]);
        } finally {
            useWeb3Signer.mockRestore();
            window.history.pushState({}, "", "/");
        }
    });

    test("should create a pre-bridge commitment swap without an invoice after selecting max", async () => {
        const driver = createPreBridgeDriver(
            vi
                .fn<BridgeDriver["getSourceTokenBalance"]>()
                .mockResolvedValue(1_000_000n),
        );
        const useWeb3Signer = mockWalletConnectEvm();
        const bridgeMocks = mockPreBridgeDriver(driver);

        try {
            await selectMaximumCommitmentSwap();
            await assertCommitmentSwapCreated();
        } finally {
            useWeb3Signer.mockRestore();
            bridgeMocks.getPreRoute.mockRestore();
            bridgeMocks.requireDriverForRoute.mockRestore();
            bridgeMocks.getDriverForAsset.mockRestore();
            window.history.pushState({}, "", "/");
        }
    });

    test("should clear committed amounts from the disabled invoice row", async () => {
        const driver = createPreBridgeDriver(
            vi
                .fn<BridgeDriver["getSourceTokenBalance"]>()
                .mockResolvedValue(1_000_000n),
        );
        const useWeb3Signer = mockWalletConnectEvm();
        const bridgeMocks = mockPreBridgeDriver(driver);

        try {
            await selectMaximumCommitmentSwap({ createSwap: false });

            fireEvent.click(screen.getByTestId("committed-invoice-clear"));

            await waitFor(() => {
                expect(signals.sendAmount().isZero()).toBe(true);
                expect(signals.receiveAmount().isZero()).toBe(true);
                expect(
                    screen.queryByTestId("committed-invoice-row"),
                ).toBeNull();
                expect(
                    screen.getByTestId("invoice") as HTMLInputElement,
                ).not.toBeDisabled();
            });
        } finally {
            useWeb3Signer.mockRestore();
            bridgeMocks.getPreRoute.mockRestore();
            bridgeMocks.requireDriverForRoute.mockRestore();
            bridgeMocks.getDriverForAsset.mockRestore();
            window.history.pushState({}, "", "/");
        }
    });

    test("should keep the max commitment flow when a pre-bridge balance lookup fails", async () => {
        const driver = createPreBridgeDriver(
            vi
                .fn<BridgeDriver["getSourceTokenBalance"]>()
                .mockRejectedValue(new Error("balance unavailable")),
        );
        const useWeb3Signer = mockWalletConnectEvm();
        const bridgeMocks = mockPreBridgeDriver(driver);

        try {
            await selectMaximumCommitmentSwap();
            await assertCommitmentSwapCreated();
        } finally {
            useWeb3Signer.mockRestore();
            bridgeMocks.getPreRoute.mockRestore();
            bridgeMocks.requireDriverForRoute.mockRestore();
            bridgeMocks.getDriverForAsset.mockRestore();
            window.history.pushState({}, "", "/");
        }
    });

    test("should show invalid address error when amount is empty and an invalid address is entered", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setOnline(true);
        globalSignals.setPairs(pairs);
        setPairAssets(LN, BTC);
        await waitFor(() => {
            expect(signals.minimum()).toBeGreaterThan(0);
        });

        const createButton = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;
        const addressInput = (await screen.findByTestId(
            "onchainAddress",
        )) as HTMLInputElement;

        await waitFor(() => {
            expect(createButton.textContent).toMatch(/^Minimum amount is /);
        });

        fireEvent.input(addressInput, {
            target: { value: "totally invalid address" },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toEqual(
                i18n.en.invalid_address.replace("{{ asset }}", BTC),
            );
        });

        fireEvent.input(addressInput, {
            target: { value: "" },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toMatch(/^Minimum amount is /);
        });
    });

    test("should show invalid invoice error when amount is empty and an invalid invoice is entered", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setOnline(true);
        globalSignals.setPairs(pairs);
        setPairAssets(BTC, LN);
        await waitFor(() => {
            expect(signals.minimum()).toBeGreaterThan(0);
        });

        const invoiceInput = (await screen.findByTestId(
            "invoice",
        )) as HTMLInputElement;
        const createButton = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;

        expect(createButton.textContent).toMatch(/^Minimum amount is /);

        fireEvent.input(invoiceInput, {
            target: { value: "totally invalid invoice" },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toEqual(i18n.en.invalid_invoice);
            expect(signals.invoiceError()).toEqual("invalid_invoice");
            expect(invoiceInput.classList.contains("invalid")).toEqual(true);
        });

        fireEvent.input(invoiceInput, {
            target: { value: "" },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toMatch(/^Minimum amount is /);
            expect(screen.getByTestId("invoice")).toBeInTheDocument();
        });
    });

    test("should re-show invalid address error after clearing a previously entered destination address", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setOnline(true);
        globalSignals.setPairs(pairs);
        setPairAssets(LN, BTC);
        await waitFor(() => {
            expect(signals.minimum()).toBeGreaterThan(0);
        });

        const createButton = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;
        const sendAmountInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;
        const addressInput = (await screen.findByTestId(
            "onchainAddress",
        )) as HTMLInputElement;

        fireEvent.input(sendAmountInput, {
            target: {
                value: `${pairs.reverse[BTC][BTC].limits.minimal}`,
            },
        });

        fireEvent.input(addressInput, {
            target: { value: "totally invalid address" },
        });

        await waitFor(() => {
            expect(createButton.textContent).toEqual(
                i18n.en.invalid_address.replace("{{ asset }}", BTC),
            );
        });

        fireEvent.input(addressInput, {
            target: { value: "" },
        });

        await waitFor(() => {
            expect(createButton.disabled).toEqual(true);
            expect(createButton.textContent).toEqual(
                i18n.en.invalid_address.replace("{{ asset }}", BTC),
            );
        });
    });

    test("should allow comma in pasted amounts", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setPairs(pairs);
        globalSignals.setSeparator(".");
        globalSignals.setDenomination(Denomination.Sat);
        setPairAssets(LN, BTC);
        await waitFor(() => {
            expect(signals.maximum()).toBeGreaterThan(0);
        });

        const pasteEvent = new Event("paste");

        // @ts-expect-error clipboardData is injected manually
        pasteEvent.clipboardData = {
            getData: vi.fn(() => "0.01"),
        };

        const preventDefaultSpy = vi.fn();
        pasteEvent.preventDefault = preventDefaultSpy;

        const sendAmountInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;

        sendAmountInput.dispatchEvent(pasteEvent);
        fireEvent.input(sendAmountInput, {
            target: {
                value: `0,01`,
            },
        });

        expect(preventDefaultSpy).not.toHaveBeenCalled(); // no errors on onPaste
        await waitFor(() => {
            expect(globalSignals.denomination()).toEqual(Denomination.Btc);
            expect(globalSignals.separator()).toEqual(".");
            expect(sendAmountInput.value).toEqual("0.01");
        });
    });

    test("should allow space in pasted amounts", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const amount = "50 000";

        globalSignals.setPairs(pairs);
        globalSignals.setDenomination(Denomination.Btc);
        setPairAssets(LN, BTC);
        await waitFor(() => {
            expect(signals.maximum()).toBeGreaterThan(0);
        });

        const pasteEvent = new Event("paste");

        // @ts-expect-error clipboardData is injected manually
        pasteEvent.clipboardData = {
            getData: vi.fn(() => amount),
        };

        const preventDefaultSpy = vi.fn();
        pasteEvent.preventDefault = preventDefaultSpy;

        const sendAmountInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;

        sendAmountInput.dispatchEvent(pasteEvent);
        fireEvent.input(sendAmountInput, {
            target: {
                value: amount,
            },
        });

        expect(preventDefaultSpy).not.toHaveBeenCalled(); // no errors on onPaste
        await waitFor(() => {
            expect(globalSignals.denomination()).toEqual(Denomination.Sat);
            expect(sendAmountInput.value).toEqual(amount);
        });
    });

    test("should drop maxlength on amount inputs when the pair is invalid", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(LN, BTC);

        await waitFor(() => {
            expect(signals.maximum()).toBeGreaterThan(0);
        });

        const sendInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;
        const receiveInput = (await screen.findByTestId(
            "receiveAmount",
        )) as HTMLInputElement;

        expect(sendInput.hasAttribute("maxlength")).toBe(true);
        expect(receiveInput.hasAttribute("maxlength")).toBe(true);

        // Fees.tsx zeros maximum when the pair is not routable
        signals.setMaximum(0);

        await waitFor(() => {
            expect(sendInput.hasAttribute("maxlength")).toBe(false);
            expect(receiveInput.hasAttribute("maxlength")).toBe(false);
        });

        signals.setMaximum(21_000_000);

        await waitFor(() => {
            expect(sendInput.hasAttribute("maxlength")).toBe(true);
            expect(receiveInput.hasAttribute("maxlength")).toBe(true);
        });
    });

    test("should allow typing past one digit when the pair is invalid", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        globalSignals.setDenomination(Denomination.Sat);
        setPairAssets(LN, BTC);

        await waitFor(() => {
            expect(signals.maximum()).toBeGreaterThan(0);
        });

        signals.setMaximum(0);

        const sendInput = (await screen.findByTestId(
            "sendAmount",
        )) as HTMLInputElement;

        await waitFor(() => {
            expect(sendInput.hasAttribute("maxlength")).toBe(false);
        });

        fireEvent.input(sendInput, { target: { value: "123456" } });

        expect(sendInput.value).toBe("123 456");
    });

    test("should keep send amount at zero when receive amount is zero", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Create />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(BTC, LBTC);
        await waitFor(() => {
            expect(signals.maximum()).toBeGreaterThan(0);
        });

        const updateConfig = () => {
            const updatedCfg = structuredClone(pairs);
            updatedCfg.chain[BTC][LBTC].fees.minerFees.server += 1;
            globalSignals.setPairs(updatedCfg);
        };

        fireEvent.input(await screen.findByTestId("receiveAmount"), {
            target: { value: "0" },
        });

        await waitFor(() => {
            expect(signals.amountChanged()).toEqual(Side.Receive);
            expect(signals.receiveAmount()).toEqual(BigNumber(0));
            expect(signals.sendAmount()).toEqual(BigNumber(0));
        });

        updateConfig();

        await waitFor(() => {
            expect(signals.receiveAmount()).toEqual(BigNumber(0));
            expect(signals.sendAmount()).toEqual(BigNumber(0));
        });
    });

    test.each`
        mobile   | fromAsset | toAsset | visible
        ${true}  | ${BTC}    | ${LN}   | ${true}
        ${true}  | ${LN}     | ${BTC}  | ${true}
        ${true}  | ${LN}     | ${RBTC} | ${false}
        ${false} | ${BTC}    | ${LN}   | ${false}
    `(
        "should show QR scanner for mobile: $mobile, toAsset: $toAsset -> $visible",
        async ({ mobile, fromAsset, toAsset, visible }) => {
            vi.mocked(isMobile).mockReturnValue(mobile);

            render(
                () => (
                    <>
                        <TestComponent />
                        <Create />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            setPairAssets(fromAsset, toAsset);

            const buttonText = globalSignals.t("scan_qr_code");
            if (visible) {
                expect(await screen.findByText(buttonText)).not.toBeNull();
            } else {
                // Flush the async camera availability check before
                // asserting the scanner is absent
                await new Promise((resolve) => setTimeout(resolve, 0));
                expect(screen.queryByText(buttonText)).toBeNull();
            }
        },
    );

    test("should hide QR scanner for locked Lightning destinations on mobile", async () => {
        vi.mocked(isMobile).mockReturnValue(true);

        const LockedCreate = () => {
            const [showCreate, setShowCreate] = createSignal(false);

            onMount(() => {
                signals.setPair(new Pair(pairs, BTC, LN, pairs));
                signals.setDestinationLocked(true);
                setShowCreate(true);
            });

            return (
                <>
                    <TestComponent />
                    <Show when={showCreate()}>
                        <Create />
                    </Show>
                </>
            );
        };

        render(() => <LockedCreate />, {
            wrapper: contextWrapper,
        });

        await waitFor(() => {
            expect(signals.destinationLocked()).toBe(true);
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(screen.queryByText(globalSignals.t("scan_qr_code"))).toBeNull();
    });
});
