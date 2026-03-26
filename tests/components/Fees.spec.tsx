import { render, screen, waitFor } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import Fees from "../../src/components/Fees";
import { BTC, LBTC, LN, RBTC, USDT0 } from "../../src/consts/Assets";
import { Denomination, SwapType } from "../../src/consts/Enums";
import * as web3Context from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";
import * as rifSigner from "../../src/rif/Signer";
import Pair from "../../src/utils/Pair";
import { getPairs } from "../../src/utils/boltzClient";
import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "../../src/utils/calculate";
import * as solanaUtils from "../../src/utils/chains/solana";
import { weiToSatoshi } from "../../src/utils/rootstock";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs } from "../pairs";

const mockUseWeb3Signer = vi.fn();

vi.mock("../../src/utils/boltzClient", () => ({
    getPairs: vi.fn(() => Promise.resolve(pairs)),
}));

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

describe("Fees component", () => {
    beforeEach(() => {
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
        vi.restoreAllMocks();
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

    test("should use the quoted Boltz input for OFT-routed service fees", async () => {
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
            preOft: null,
            dexHopBeforeBoltz: null,
            feePercentage: 1,
            minerFees: 0,
            maxRoutingFee: undefined,
            oftMessagingFeeToken: undefined,
            oftTransferFeeAsset: undefined,
            feeOnSend,
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1480)),
            oftMessagingFeeFromLatestQuote: vi.fn(() => undefined),
            oftTransferFeeFromLatestQuote: vi.fn(() => undefined),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2000));

        await waitFor(() => {
            expect(screen.getByTestId("boltz-fee").textContent).toEqual(
                "0.00000015",
            );
        });
        expect(feeOnSend).toHaveBeenCalled();
        expect(feeOnSend.mock.calls.at(-1)?.[0].toNumber()).toBe(1480);
    });

    test("should display legacy mesh transfer fees when present", async () => {
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
            oftMessagingFeeToken: "ETH",
            oftTransferFeeAsset: USDT0,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            oftMessagingFeeFromLatestQuote: vi.fn(() => 0n),
            oftTransferFeeFromLatestQuote: vi.fn(() => BigNumber(30_000)),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setSendAmount(BigNumber(2_000_000));

        await waitFor(() => {
            expect(screen.getByTestId("legacy-mesh-fee").textContent).toEqual(
                "0.030000",
            );
        });
    });

    test("should display the Solana token account fee when creation is required", async () => {
        vi.spyOn(
            solanaUtils,
            "shouldCreateSolanaTokenAccount",
        ).mockResolvedValue(true);

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
            oftMessagingFeeToken: "ETH",
            oftTransferFeeAsset: USDT0,
            feeOnSend: vi.fn(() => BigNumber(0)),
            boltzSwapSendAmountFromLatestQuote: vi.fn(() => BigNumber(1000)),
            oftMessagingFeeFromLatestQuote: vi.fn(() => 0n),
            oftTransferFeeFromLatestQuote: vi.fn(() => BigNumber(0)),
            getMinimum: vi.fn().mockResolvedValue(1),
            getMaximum: vi.fn().mockResolvedValue(10_000),
        } as unknown as Pair;

        signals.setPair(mockPair);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "BZkwksSEeHrCVS3HeewBJKEBTEEuwnEqpkHqEg1dRpuE",
        );

        await waitFor(() => {
            expect(
                screen.getByTestId("solana-token-account-creation-fee")
                    .textContent,
            ).toEqual("0.00203928");
        });
        expect(
            screen.getByTestId("solana-token-account-creation-fee")
                .parentElement?.textContent,
        ).toContain("0.00203928 SOL");
        expect(
            screen.getByTestId("solana-token-account-creation-fee")
                .parentElement?.textContent,
        ).toContain(`${i18n.en.solana_token_account_fee_label}:`);

        expect(solanaUtils.shouldCreateSolanaTokenAccount).toHaveBeenCalledWith(
            "USDT0-SOL",
            "BZkwksSEeHrCVS3HeewBJKEBTEEuwnEqpkHqEg1dRpuE",
        );
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
