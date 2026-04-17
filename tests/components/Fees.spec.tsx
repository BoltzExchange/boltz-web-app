import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { config as runtimeConfig } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { BTC, LBTC, LN, RBTC, USDT0 } from "../../src/consts/Assets";
import { Denomination, SwapType } from "../../src/consts/Enums";
import * as web3Context from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";
import * as rifSigner from "../../src/rif/Signer";
import Pair, { BridgeMessagingFeeDisplayMode } from "../../src/utils/Pair";
import { getPairs } from "../../src/utils/boltzClient";
import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "../../src/utils/calculate";
import * as fiat from "../../src/utils/fiat";
import { weiToSatoshi } from "../../src/utils/rootstock";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs } from "../pairs";

const mockUseWeb3Signer = vi.fn();
const originalAssets = structuredClone(runtimeConfig.assets ?? {});

vi.mock("../../src/utils/boltzClient", () => ({
    getPairs: vi.fn(() => Promise.resolve(pairs)),
}));

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

describe("Fees component", () => {
    beforeAll(() => {
        const bridgeVariants = [
            "USDT0-SOL",
            "USDT0-POL",
            "USDT0-ETH",
            "USDT0-SEI",
        ];
        runtimeConfig.assets = {
            ...runtimeConfig.assets,
            ...Object.fromEntries(
                bridgeVariants
                    .filter(
                        (asset) => mainnetConfig.assets[asset] !== undefined,
                    )
                    .map((asset) => [
                        asset,
                        structuredClone(mainnetConfig.assets[asset]),
                    ]),
            ),
            // Synthetic variant used only in tests (not in mainnet config).
            "USDT0-ARB": structuredClone(mainnetConfig.assets["USDT0-ETH"]),
        };
    });

    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(fiat, "getBtcPriceFailover").mockResolvedValue(
            BigNumber(100_000),
        );
        vi.spyOn(fiat, "getGasTokenPriceFailover").mockResolvedValue(
            BigNumber(200),
        );
        vi.spyOn(web3Context, "useWeb3Signer").mockImplementation(
            () =>
                mockUseWeb3Signer() as ReturnType<
                    typeof web3Context.useWeb3Signer
                >,
        );
        mockUseWeb3Signer.mockReturnValue({
            signer: () => ({
                address: "0xsigner",
                getAddress: vi.fn().mockResolvedValue("0xsigner"),
                provider: {
                    getBalance: vi.fn().mockResolvedValue(1_000_000_000_000n),
                    getFeeData: vi.fn().mockResolvedValue({
                        gasPrice: 100_000_000n,
                    }),
                },
            }),
            getGasAbstractionSigner: vi
                .fn()
                .mockReturnValue({ address: "0xgas" }),
        });
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterAll(() => {
        runtimeConfig.assets = originalAssets;
    });

    test("should render", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setPairs(pairs);
    });

    test("should render inline fee denominators and routing fees", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);
        globalSignals.setDenomination(Denomination.Btc);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: LN,
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 300,
            maxRoutingFee: 0.0123,
            bridgeMessagingFeeToken: undefined,
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(200)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(() => undefined),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("routing-fee-limit").textContent).toEqual(
                "123 ppm",
            );
        });

        expect(
            screen
                .getByTestId("network-fee")
                .parentElement?.querySelector(
                    '.denominator[data-denominator="btc"]',
                ),
        ).not.toBeNull();
        expect(
            screen
                .getByTestId("boltz-fee")
                .parentElement?.querySelector(
                    '.denominator[data-denominator="btc"]',
                ),
        ).not.toBeNull();
        expect(
            screen.getByTestId("routing-fee-limit").closest(".fees-extra-line"),
        ).not.toBeNull();
    });

    test("should recalculate limits on direction switch", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setPairs(pairs);

        setPairAssets(LN, BTC);

        await waitFor(() => {
            expect(signals.minimum()).toEqual(
                pairs.submarine[BTC][BTC].limits.minimal,
            );
            expect(signals.maximum()).toEqual(
                pairs.submarine[BTC][BTC].limits.maximal,
            );
        });

        setPairAssets(BTC, LN);

        await waitFor(() => {
            expect(signals.minimum()).toEqual(
                calculateSendAmount(
                    BigNumber(pairs.submarine[BTC][BTC].limits.minimal),
                    signals.boltzFee(),
                    signals.minerFee(),
                    SwapType.Submarine,
                ).toNumber(),
            );
            expect(signals.maximum()).toEqual(
                calculateSendAmount(
                    BigNumber(pairs.submarine[BTC][BTC].limits.maximal),
                    signals.boltzFee(),
                    signals.minerFee(),
                    SwapType.Submarine,
                ).toNumber(),
            );
        });
    });

    test("should increase the miner fee for reverse swaps by 1 when sending to an unconfidential Liquid address", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setPairs(pairs);
        setPairAssets(LN, LBTC);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "ert1q2vf850cshpedhvn9x0lv33j8az4ela04afuzp0",
        );

        const fees = pairs.reverse[BTC][LBTC].fees;
        expect(signals.minerFee()).toEqual(
            fees.minerFees.lockup + fees.minerFees.claim + 5,
        );
    });

    test("should increase the miner fee for chain swaps by 1 when sending to an unconfidential Liquid address", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);
        setPairAssets(BTC, LBTC);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "ert1q2vf850cshpedhvn9x0lv33j8az4ela04afuzp0",
        );

        const fees = pairs.chain[BTC][LBTC].fees;
        expect(signals.minerFee()).toEqual(
            fees.minerFees.server + fees.minerFees.user.claim + 5,
        );
    });

    test("should apply minimalBatched limit for liquid submarine swaps", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setPairs(pairs);
        setPairAssets(LBTC, LN);
        signals.setSendAmount(BigNumber(41));
        await waitFor(() => {
            expect(signals.minimum()).toEqual(41);
        });
    });

    test("should show the rif relay message only for rif relay gas abstraction", async () => {
        vi.spyOn(rifSigner, "getSmartWalletAddress").mockResolvedValue({
            address: "0xsmartwallet",
            nonce: 0n,
        });

        mockUseWeb3Signer.mockReturnValueOnce({
            signer: () => ({
                address: "0xsigner",
                getAddress: vi.fn().mockResolvedValue("0xsigner"),
                provider: {
                    getBalance: vi.fn().mockResolvedValue(0n),
                    getFeeData: vi.fn().mockResolvedValue({
                        gasPrice: 100_000_000n,
                    }),
                },
            }),
            getGasAbstractionSigner: vi
                .fn()
                .mockReturnValue({ address: "0xgas" }),
        });

        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setNotification("");
        globalSignals.setPairs(pairs);
        setPairAssets(BTC, RBTC);

        const baseMinerFee =
            pairs.chain[BTC][RBTC].fees.minerFees.server +
            pairs.chain[BTC][RBTC].fees.minerFees.user.claim;
        const gasAbstractionExtraCost = Number(
            weiToSatoshi(100_000_000n * 157_000n),
        );

        await waitFor(() => {
            expect(globalSignals.notification()).toEqual(i18n.en.rif_extra_fee);
            expect(signals.minerFee()).toEqual(
                baseMinerFee + gasAbstractionExtraCost,
            );
        });
    });

    test("should not show the rif relay message for signer gas abstraction", async () => {
        const pairsWithUsdt0 = {
            ...pairs,
            chain: {
                ...pairs.chain,
                BTC: {
                    ...pairs.chain.BTC,
                    USDT0: {
                        ...pairs.chain.BTC.RBTC,
                        hash: "usdt0-pair-hash",
                    },
                },
            },
        };

        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setNotification("");
        globalSignals.setPairs(pairsWithUsdt0);
        setPairAssets(BTC, USDT0);

        const baseMinerFee =
            pairsWithUsdt0.chain[BTC][USDT0].fees.minerFees.server +
            pairsWithUsdt0.chain[BTC][USDT0].fees.minerFees.user.claim;

        await waitFor(() => {
            expect(signals.minerFee()).toEqual(baseMinerFee);
        });
        expect(globalSignals.notification()).toEqual("");
    });

    test("should use the quoted Boltz input for bridge-routed service fees", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);
        globalSignals.setDenomination(Denomination.Btc);

        const feeOnSend = vi.fn((amount: BigNumber) =>
            calculateBoltzFeeOnSend(amount, 1, 0, SwapType.Submarine),
        );
        const mockPair = {
            isRoutable: true,
            fromAsset: "USDT0-POL",
            toAsset: LN,
            swapToCreate: {
                type: SwapType.Submarine,
            },
            preBridge: null,
            dexHopBeforeBoltz: null,
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeToken: undefined,
            bridgeTransferFeeAsset: undefined,
            feeOnSend,
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1480)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(() => undefined),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2000));

        fireEvent.click(screen.getByTestId("fees-toggle"));

        await waitFor(() => {
            expect(screen.getByTestId("boltz-fee").textContent).toEqual(
                "0.00000015",
            );
        });
        expect(feeOnSend).toHaveBeenCalled();
        expect(feeOnSend.mock.calls.at(-1)?.[0].toNumber()).toBe(1480);
    });

    test("should display bridge transfer fees when present", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);
        globalSignals.setDenomination(Denomination.Btc);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: "USDT0-SOL",
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: false,
            bridgeMessagingFeeDisplayMode: BridgeMessagingFeeDisplayMode.Inline,
            bridgeMessagingFeeToken: "ETH",
            bridgeTransferFeeAsset: USDT0,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(() => 0n),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => BigNumber(30_000)),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        fireEvent.click(screen.getByTestId("fees-toggle"));

        await waitFor(() => {
            expect(
                screen.getByTestId("bridge-transfer-fee").textContent,
            ).toEqual("0.030000");
        });
        expect(
            screen.getByText((content) =>
                content.includes("Bridge transfer fee"),
            ),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("bridge-messaging-fee")).toBeNull();
    });

    test("should ignore legacy mesh transfer fees without an asset config", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: "USDT0-SOL",
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: false,
            bridgeMessagingFeeDisplayMode: BridgeMessagingFeeDisplayMode.Inline,
            bridgeMessagingFeeToken: undefined,
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(() => undefined),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => BigNumber(30_000)),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("fees-total-amount").textContent).toEqual(
                "0.00",
            );
        });
    });

    test("should show post-bridge messaging fees only inside the expanded details", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: "USDT0-ETH",
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: true,
            bridgeMessagingFeeDisplayMode:
                BridgeMessagingFeeDisplayMode.Details,
            bridgeMessagingFeeToken: "ETH",
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(
                () => 1_000_000_000_000_000n,
            ),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("fees-total-amount").textContent).toEqual(
                "0.20",
            );
        });

        expect(document.querySelector(".fees-extra-line")).toBeNull();

        fireEvent.click(screen.getByTestId("fees-toggle"));

        expect(
            screen.getByText((content) =>
                content.includes("Bridge messaging fee"),
            ),
        ).toBeInTheDocument();
        expect(screen.getByTestId("bridge-messaging-fee").textContent).toEqual(
            "0.001",
        );
    });

    test("should show the fiat rate fallback when the post-bridge fee token is unsupported", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: "USDT0-ARB",
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: true,
            bridgeMessagingFeeDisplayMode:
                BridgeMessagingFeeDisplayMode.Details,
            bridgeMessagingFeeToken: "ARB",
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(
                () => 1_000_000_000_000_000n,
            ),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("fees-toggle").textContent).toContain(
                "USD rate unavailable",
            );
        });
        expect(screen.queryByTestId("fees-total-amount")).toBeNull();
        expect(document.querySelector(".fees-toggle .skeleton")).toBeNull();
    });

    test("should not render zero bridge messaging fees for SEI routes", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: "USDT0-SEI",
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: true,
            bridgeMessagingFeeDisplayMode:
                BridgeMessagingFeeDisplayMode.Details,
            bridgeMessagingFeeToken: "SEI",
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(() => 0n),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("fees-total-amount").textContent).toEqual(
                "0.00",
            );
        });

        fireEvent.click(screen.getByTestId("fees-toggle"));

        expect(screen.queryByTestId("bridge-messaging-fee")).toBeNull();
    });

    test("should use the bridge messaging fee token decimals for USD totals and display formatting", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: USDT0,
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: true,
            bridgeMessagingFeeDisplayMode:
                BridgeMessagingFeeDisplayMode.Details,
            bridgeMessagingFeeToken: USDT0,
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(() => 1_000_000n),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("fees-total-amount").textContent).toEqual(
                "200.00",
            );
        });

        fireEvent.click(screen.getByTestId("fees-toggle"));

        expect(screen.getByTestId("bridge-messaging-fee").textContent).toEqual(
            "1",
        );
        expect(
            screen
                .getByTestId("bridge-messaging-fee")
                .parentElement?.querySelector(
                    '.denominator[data-denominator="USDT"]',
                ),
        ).not.toBeNull();
    });

    test("should keep pre-bridge messaging fees in the inline summary row", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);

        const mockPair = {
            isRoutable: true,
            fromAsset: "USDT0-POL",
            toAsset: BTC,
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: false,
            bridgeMessagingFeeDisplayMode: BridgeMessagingFeeDisplayMode.Inline,
            bridgeMessagingFeeToken: "POL",
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(
                () => 1_000_000_000_000_000n,
            ),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(
                screen.getByTestId("bridge-messaging-fee").textContent,
            ).toEqual("0.001");
        });
        expect(document.querySelector(".fees-extra-line")).not.toBeNull();
        expect(
            screen.getByText((content) =>
                content.includes("Bridge messaging fee"),
            ),
        ).toBeInTheDocument();
        expect(
            document.querySelectorAll('[data-testid="bridge-messaging-fee"]')
                .length,
        ).toEqual(1);
        expect(
            screen
                .getByTestId("bridge-messaging-fee")
                .parentElement?.querySelector(".denominator-text")?.textContent,
        ).toEqual("POL");
    });

    test("should show the collapsed USD fee total and expand details on toggle", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);
        globalSignals.setDenomination(Denomination.Btc);

        const mockPair = {
            isRoutable: true,
            fromAsset: BTC,
            toAsset: "USDT0-SOL",
            swapToCreate: {
                type: SwapType.Submarine,
            },
            feePercentage: 1,
            minerFees: 300,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: true,
            bridgeMessagingFeeDisplayMode:
                BridgeMessagingFeeDisplayMode.Details,
            bridgeMessagingFeeToken: "ETH",
            bridgeTransferFeeAsset: USDT0,
            feeOnSend: vi.fn(() => BigNumber(200)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(
                () => 1_000_000_000_000_000n,
            ),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => BigNumber(30_000)),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("fees-total-amount").textContent).toEqual(
                "0.73",
            );
        });

        const toggle = screen.getByTestId("fees-toggle");
        expect(toggle.getAttribute("aria-expanded")).toEqual("false");

        fireEvent.click(toggle);

        expect(toggle.getAttribute("aria-expanded")).toEqual("true");
        expect(screen.getByTestId("network-fee").textContent).toEqual(
            "0.00000300",
        );
        expect(screen.getByTestId("boltz-fee").textContent).toEqual(
            "0.00000200",
        );
        expect(screen.getByTestId("bridge-transfer-fee").textContent).toEqual(
            "0.030000",
        );
        expect(screen.getByTestId("bridge-messaging-fee").textContent).toEqual(
            "0.001",
        );
        expect(
            screen
                .getByTestId("network-fee")
                .parentElement?.querySelector(
                    '.denominator[data-denominator="btc"]',
                ),
        ).not.toBeNull();
        expect(
            screen
                .getByTestId("boltz-fee")
                .parentElement?.querySelector(
                    '.denominator[data-denominator="btc"]',
                ),
        ).not.toBeNull();
        expect(
            screen
                .getByTestId("bridge-transfer-fee")
                .parentElement?.querySelector(
                    '.denominator[data-denominator="USDT"]',
                ),
        ).not.toBeNull();
        expect(
            screen
                .getByTestId("bridge-messaging-fee")
                .parentElement?.querySelector(".denominator-text-symbol")
                ?.textContent,
        ).toEqual("Ξ");
    });

    test("should format Solana bridge messaging fees in lamports", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Fees />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setPairs(pairs);

        const mockPair = {
            isRoutable: true,
            fromAsset: "USDT0-SOL",
            toAsset: BTC,
            swapToCreate: {
                type: SwapType.Chain,
            },
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            bridgeMessagingFeeIncludedInTotal: false,
            bridgeMessagingFeeDisplayMode: BridgeMessagingFeeDisplayMode.Inline,
            bridgeMessagingFeeToken: "SOL",
            bridgeTransferFeeAsset: undefined,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            bridgeMessagingFeeFromLatestQuote: vi.fn(() => 500_000_000n),
            bridgeTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000));

        await waitFor(() => {
            expect(
                screen.getByTestId("bridge-messaging-fee").textContent,
            ).toEqual("0.5");
        });
    });

    test.each`
        sendAmount
        ${1000153}
        ${0}
    `(
        "should always display fees with 8 decimal places in BTC denomination (sendAmount: $sendAmount)",
        async ({ sendAmount }) => {
            // Override pairs with custom fees for this test
            const proFee = {
                ...pairs,
                submarine: {
                    ...pairs.submarine,
                    BTC: {
                        ...pairs.submarine.BTC,
                        BTC: {
                            ...pairs.submarine.BTC.BTC,
                            fees: {
                                percentage: -0.03,
                                minerFees: 453,
                            },
                        },
                    },
                },
            };

            vi.mocked(getPairs).mockResolvedValueOnce(proFee);

            render(
                () => (
                    <>
                        <TestComponent />
                        <Fees />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            globalSignals.setDenomination(Denomination.Btc);
            setPairAssets(BTC, LN);
            signals.setSendAmount(BigNumber(sendAmount));
            signals.setReceiveAmount(
                calculateReceiveAmount(
                    BigNumber(sendAmount),
                    signals.boltzFee(),
                    signals.minerFee(),
                    SwapType.Submarine,
                ),
            );

            const networkFeeElement = (await screen.findByTestId("network-fee"))
                .textContent;
            const boltzFeeElement = (await screen.findByTestId("boltz-fee"))
                .textContent;

            const networkFeeDecimalPart = networkFeeElement.split(".")[1];
            const boltzFeeDecimalPart = boltzFeeElement.split(".")[1];

            expect(networkFeeDecimalPart).toHaveLength(8);
            expect(boltzFeeDecimalPart).toHaveLength(8);
        },
    );
});
