import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import { BTC, LBTC, LN, RBTC } from "../../src/consts/Assets";
import { Side, SwapType } from "../../src/consts/Enums";
import { Denomination } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import Create from "../../src/pages/Create";
import Pair from "../../src/utils/Pair";
import { calculateReceiveAmount } from "../../src/utils/calculate";
import { formatAmount } from "../../src/utils/denomination";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs } from "../pairs";

vi.mock("../../src/utils/boltzClient", () => ({
    getPairs: vi.fn(() => Promise.resolve(pairs)),
}));
vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <div data-testid="connect-wallet" />,
}));

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

describe("Create", () => {
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

            const currentPair = signals.pair();
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

            expect(
                within(button).queryByTestId("loading-spinner"),
            ).not.toBeInTheDocument();

            fireEvent.input(await screen.findByTestId("sendAmount"), {
                target: { value: "100000" },
            });

            expect(
                within(button).getByTestId("loading-spinner"),
            ).toBeInTheDocument();

            await vi.advanceTimersByTimeAsync(500);

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

            await vi.advanceTimersByTimeAsync(500);

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

    test.each`
        extrema
        ${"min"}
        ${"max"}
    `("should set $extrema amount on click", async ({ extrema }) => {
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

        const amount =
            extrema === "min" ? signals.minimum() : signals.maximum();

        const formattedAmount = formatAmount(
            BigNumber(amount),
            Denomination.Sat,
            globalSignals.separator(),
            BTC,
        );
        fireEvent.click(await screen.findByText(formattedAmount));

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
            expect(createButton.textContent).toEqual(
                "Minimum amount is 50 000 sats",
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
});
