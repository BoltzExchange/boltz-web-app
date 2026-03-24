import { BigNumber } from "bignumber.js";
import { formatEther } from "ethers";
import { VsChevronDown, VsChevronRight } from "solid-icons/vs";
import type { Accessor } from "solid-js";
import {
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onMount,
} from "solid-js";
import { gasTokenToGetUsdCents } from "src/utils/qouter";

import { config } from "../config";
import { BTC, LBTC } from "../consts/Assets";
import { Currency, SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import {
    shouldCreateSolanaTokenAccount,
    solanaAtaRentExemptLamports,
} from "../utils/chains/solana";
import { isConfidentialAddress } from "../utils/compat";
import { formatAmount, formatDenomination } from "../utils/denomination";
import {
    convertAssetFeeToUsd,
    convertToFiat,
    getGasTokenPriceFailover,
} from "../utils/fiat";
import { getPair } from "../utils/helper";
import { weiToSatoshi } from "../utils/rootstock";
import { GasAbstractionType } from "../utils/swapCreator";
import { getClaimAddress } from "./CreateButton";
import Denomination from "./settings/Denomination";
import Tooltip from "./settings/Tooltip";

const ppmFactor = 10_000;

// When sending to an unconfidential address, we need to add an extra
// confidential OP_RETURN output with 1 sat inside
export const unconfidentialExtra = 5;

const gasAbstractionExtraGasCost = 157_000n;
const solanaLamportsPerSol = BigNumber(1_000_000_000);

export const getFeeHighlightClass = (fee: number, regularFee: number) => {
    if (fee < 0) {
        return "negative-fee";
    }

    if (fee >= 0 && fee < regularFee) {
        return "lower-fee";
    }

    return "";
};

export const isToUnconfidentialLiquid = ({
    assetReceive,
    addressValid,
    onchainAddress,
}: {
    assetReceive: Accessor<string>;
    addressValid: Accessor<boolean>;
    onchainAddress: Accessor<string>;
}) =>
    assetReceive() === LBTC &&
    addressValid() &&
    !isConfidentialAddress(onchainAddress());

const Fees = () => {
    const {
        t,
        pairs,
        fetchPairs,
        denomination,
        separator,
        notify,
        regularPairs,
        fetchRegularPairs,
        btcPrice,
        fetchBtcPrice,
    } = useGlobalContext();
    const {
        pair,
        sendAmount,
        receiveAmount,
        setMaximum,
        setMinimum,
        minerFee,
        setMinerFee,
        boltzFee,
        setBoltzFee,
        onchainAddress,
        addressValid,
        getGasToken,
    } = useCreateContext();
    const { signer, getGasAbstractionSigner } = useWeb3Signer();

    const [feesExpanded, setFeesExpanded] = createSignal(false);

    const swapType = () => pair().swapToCreate?.type;
    const assetSend = () => pair().fromAsset;
    const assetReceive = () => pair().toAsset;

    const boltzFeeAmount = createMemo(() => {
        if (!pair().isRoutable) {
            return BigNumber(0);
        }

        receiveAmount();

        const boltzSwapSendAmount =
            pair().boltzSwapSendAmountFromLatestQuote(sendAmount());
        if (boltzSwapSendAmount === undefined) {
            return BigNumber(0);
        }

        return pair().feeOnSend(boltzSwapSendAmount);
    });
    const oftMessagingFee = createMemo(() => {
        if (!pair().isRoutable) {
            return undefined;
        }

        receiveAmount();

        return pair().oftMessagingFeeFromLatestQuote(sendAmount());
    });
    const formattedOftMessagingFee = createMemo(() => {
        const fee = oftMessagingFee();
        if (fee === undefined) {
            return undefined;
        }

        return BigNumber(formatEther(fee))
            .toFixed(6)
            .replace(/\.?0+$/, "");
    });
    const shouldShowOftMessagingFee = createMemo(() => {
        if (formattedOftMessagingFee() === undefined) {
            return false;
        }

        return pair().hasPreOft || !pair().hasPostOft;
    });
    const oftTransferFee = createMemo(() => {
        if (!pair().isRoutable) {
            return undefined;
        }

        receiveAmount();

        return pair().oftTransferFeeFromLatestQuote(sendAmount());
    });
    const solanaTokenAccountCreationTrigger = createMemo(() => ({
        destinationAsset: assetReceive(),
        recipient: addressValid() ? onchainAddress() : undefined,
    }));
    const [requiresSolanaTokenAccountCreation] = createResource(
        solanaTokenAccountCreationTrigger,
        ({ destinationAsset, recipient }) =>
            shouldCreateSolanaTokenAccount(destinationAsset, recipient),
    );
    const formattedSolanaTokenAccountCreationFee = createMemo(() =>
        BigNumber(solanaAtaRentExemptLamports.toString())
            .dividedBy(solanaLamportsPerSol)
            .toFixed(9)
            .replace(/\.?0+$/, ""),
    );

    const [solUsdPrice] = createResource(
        () => requiresSolanaTokenAccountCreation() === true || undefined,
        () => getGasTokenPriceFailover("SOL", Currency.USD),
    );

    const totalCollapsibleFeesUsdView = createMemo(() => {
        receiveAmount();

        const rate = btcPrice();
        const solRate = solUsdPrice();
        const minerBoltzSats = BigNumber(minerFee()).plus(boltzFeeAmount());
        const solAccountFeeApplies =
            requiresSolanaTokenAccountCreation() === true;

        if (solAccountFeeApplies) {
            if (solUsdPrice.loading) {
                return { status: "loading" as const };
            }

            if (!(solRate instanceof BigNumber)) {
                return { status: "error" as const };
            }
        }

        if (minerBoltzSats.isGreaterThan(0)) {
            if (rate === null) {
                return { status: "loading" as const };
            }

            if (rate instanceof Error) {
                return { status: "error" as const };
            }
        }

        const mesh = oftTransferFee();
        const meshAsset = pair().oftTransferFeeAsset;
        const meshUsd =
            mesh !== undefined &&
            mesh.isGreaterThan(0) &&
            meshAsset !== undefined
                ? convertAssetFeeToUsd(
                      mesh,
                      meshAsset,
                      rate instanceof BigNumber ? rate : BigNumber(0),
                  )
                : BigNumber(0);

        const gasUsd = getGasToken()
            ? BigNumber(gasTokenToGetUsdCents).dividedBy(100)
            : BigNumber(0);

        const btcFeesUsd =
            rate instanceof BigNumber && minerBoltzSats.isGreaterThan(0)
                ? convertToFiat(minerBoltzSats, rate)
                : BigNumber(0);

        const solUsd =
            solAccountFeeApplies && solRate instanceof BigNumber
                ? BigNumber(solanaAtaRentExemptLamports.toString())
                      .dividedBy(solanaLamportsPerSol)
                      .multipliedBy(solRate)
                : BigNumber(0);

        return {
            status: "ok" as const,
            amount: btcFeesUsd.plus(meshUsd).plus(gasUsd).plus(solUsd),
        };
    });

    const gasAbstractionTrigger = createMemo(() => {
        return {
            signer: signer(),
            assetReceive: assetReceive(),
            assetSend: assetSend(),
        };
    });
    const [gasAbstractionExtraCost] = createResource(
        gasAbstractionTrigger,
        async ({ signer, assetReceive, assetSend }) => {
            if (signer === undefined) {
                return 0;
            }

            const { gasAbstraction, gasPrice } = await getClaimAddress(
                () => assetReceive,
                () => assetSend,
                () => signer,
                onchainAddress,
                getGasAbstractionSigner,
                getGasToken(),
            );
            switch (gasAbstraction.claim) {
                case GasAbstractionType.RifRelay:
                    notify("success", t("rif_extra_fee"));
                    return Number(
                        weiToSatoshi(gasPrice * gasAbstractionExtraGasCost),
                    );

                case GasAbstractionType.None:
                case GasAbstractionType.Signer:
                    return 0;
            }
        },
        { initialValue: 0 },
    );

    createEffect(() => {
        // Updating the miner fee with "setMinerFee(minerFee() + gasAbstractionExtraCost())"
        // causes an endless loop of triggering the effect again
        const updateMinerFee = (fee: number) => {
            setMinerFee(fee + gasAbstractionExtraCost());
        };

        if (pairs() && pair().isRoutable) {
            setBoltzFee(pair().feePercentage);

            const swapToCreate = pair().swapToCreate;
            if (!swapToCreate) return;

            switch (swapToCreate.type) {
                case SwapType.Submarine:
                    updateMinerFee(pair().minerFees);
                    break;

                case SwapType.Reverse:
                case SwapType.Chain: {
                    let fee = pair().minerFees;
                    if (
                        isToUnconfidentialLiquid({
                            assetReceive,
                            addressValid,
                            onchainAddress,
                        })
                    ) {
                        fee += unconfidentialExtra;
                    }

                    updateMinerFee(fee);
                    break;
                }
            }

            const initiatingPair = pair();
            void Promise.all([
                initiatingPair.getMinimum(),
                initiatingPair.getMaximum(),
            ]).then(([min, max]) => {
                if (pair() !== initiatingPair) {
                    return;
                }

                setMinimum(min);
                setMaximum(max);
            });
        }
    });

    void fetchPairs();

    onMount(() => {
        if (config.isPro) {
            void fetchRegularPairs();
        }

        void fetchBtcPrice();
    });

    return (
        <div class="fees-dyn">
            <div class="fees-dyn-denom">
                <Denomination />
            </div>
            <div class="fees-dyn-right">
                <button
                    type="button"
                    class="fees-toggle"
                    data-testid="fees-toggle"
                    aria-expanded={feesExpanded()}
                    onClick={() => setFeesExpanded(!feesExpanded())}>
                    <span class="fees-toggle-icon">
                        <Show
                            when={feesExpanded()}
                            fallback={<VsChevronRight />}>
                            <VsChevronDown />
                        </Show>
                    </span>
                    {t("swap_fees")}:{" "}
                    <Switch>
                        <Match
                            when={
                                totalCollapsibleFeesUsdView().status === "ok" &&
                                totalCollapsibleFeesUsdView()
                            }
                            keyed>
                            {(view) => (
                                <>
                                    ≈{" "}
                                    <span data-testid="fees-total-amount">
                                        {view.amount.toFixed(2)}
                                    </span>{" "}
                                    {Currency.USD}
                                </>
                            )}
                        </Match>
                        <Match
                            when={
                                totalCollapsibleFeesUsdView().status ===
                                "loading"
                            }>
                            <span class="skeleton" />
                        </Match>
                        <Match
                            when={
                                totalCollapsibleFeesUsdView().status === "error"
                            }>
                            {t("fiat_rate_not_available")}
                        </Match>
                    </Switch>
                </button>
                <div
                    class="fees-details-shell"
                    classList={{ "is-expanded": feesExpanded() }}
                    aria-hidden={!feesExpanded()}
                    inert={!feesExpanded() || undefined}>
                    <div class="fees-details-inner">
                        <label class="fees-details">
                            {t("network_fee")}:{" "}
                            <span class="network-fee" data-testid="network-fee">
                                {formatAmount(
                                    BigNumber(minerFee()),
                                    denomination(),
                                    separator(),
                                    BTC,
                                    true,
                                )}
                            </span>
                            <span
                                class="denominator"
                                data-denominator={denomination()}
                            />
                            <br />
                            {t("fee")} (
                            <span
                                class={
                                    config.isPro &&
                                    getFeeHighlightClass(
                                        boltzFee(),
                                        getPair(
                                            regularPairs(),
                                            swapType(),
                                            assetSend(),
                                            assetReceive(),
                                        )?.fees.percentage,
                                    )
                                }>
                                {boltzFee()
                                    .toString()
                                    .replaceAll(".", separator())}
                                %
                            </span>
                            ):{" "}
                            <span class="boltz-fee" data-testid="boltz-fee">
                                {formatAmount(
                                    boltzFeeAmount(),
                                    denomination(),
                                    separator(),
                                    BTC,
                                    true,
                                )}
                            </span>
                            <span
                                class="denominator"
                                data-denominator={denomination()}
                            />
                            <Show when={pair().maxRoutingFee !== undefined}>
                                <br />
                                {t("routing_fee_limit")}:{" "}
                                <span data-testid="routing-fee-limit">
                                    {pair().maxRoutingFee * ppmFactor} ppm
                                </span>
                            </Show>
                            <Show
                                when={
                                    oftTransferFee() !== undefined &&
                                    oftTransferFee()!.isGreaterThan(0) &&
                                    pair().oftTransferFeeAsset !== undefined
                                }>
                                <br />
                                {t("legacy_mesh_fee_label")}:{" "}
                                <span data-testid="legacy-mesh-fee">
                                    {formatAmount(
                                        oftTransferFee()!,
                                        denomination(),
                                        separator(),
                                        pair().oftTransferFeeAsset!,
                                        true,
                                    )}
                                </span>
                                <span
                                    class="denominator"
                                    data-denominator={formatDenomination(
                                        denomination(),
                                        pair().oftTransferFeeAsset!,
                                    )}
                                />
                            </Show>
                            <Show
                                when={
                                    requiresSolanaTokenAccountCreation() ===
                                    true
                                }>
                                <br />
                                <Tooltip
                                    label={{
                                        key: "solana_token_account_fee_label",
                                    }}
                                    direction={["left"]}>
                                    <span class="fees-abbrev-underline">
                                        {t("solana_token_account_fee_abbrev")}
                                    </span>
                                </Tooltip>
                                {": "}
                                <span data-testid="solana-token-account-creation-fee">
                                    {formattedSolanaTokenAccountCreationFee()}
                                </span>
                                {" SOL"}
                            </Show>
                            <Show when={getGasToken()}>
                                <br />
                                {t("gas_topup_label", {
                                    cost: gasTokenToGetUsdCents,
                                    gasToken:
                                        config.assets?.[assetReceive()]?.network
                                            ?.gasToken ?? "",
                                })}{" "}
                                <span
                                    class="denominator"
                                    data-denominator="usd"
                                />
                            </Show>
                        </label>
                    </div>
                </div>
                <Show when={shouldShowOftMessagingFee()}>
                    <span class="fees-oft-line">
                        {t("oft_messaging_fee_label")}:{" "}
                        <span
                            class="oft-messaging-fee"
                            data-testid="oft-messaging-fee">
                            {formattedOftMessagingFee()}
                        </span>{" "}
                        {pair().oftMessagingFeeToken}
                    </span>
                </Show>
            </div>
        </div>
    );
};

export default Fees;
