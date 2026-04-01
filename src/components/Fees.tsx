import { BigNumber } from "bignumber.js";
import type { Accessor } from "solid-js";
import {
    Show,
    createEffect,
    createMemo,
    createResource,
    onMount,
} from "solid-js";

import { config } from "../config";
import { BTC, LBTC, isUsdt0Asset } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { isConfidentialAddress } from "../utils/compat";
import { formatAmount } from "../utils/denomination";
import { getPair } from "../utils/helper";
import { weiToSatoshi } from "../utils/rootstock";
import { GasAbstractionType } from "../utils/swapCreator";
import AmountDenominator from "./AmountDenominator";
import { getClaimAddress } from "./CreateButton";
import FeesCollapse from "./FeesCollapse";
import Denomination from "./settings/Denomination";

const ppmFactor = 10_000;

// When sending to an unconfidential address, we need to add an extra
// confidential OP_RETURN output with 1 sat inside
export const unconfidentialExtra = 5;

const gasAbstractionExtraGasCost = 157_000n;

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

export const RoutingFee = (props: { addLineBreak?: boolean }) => {
    const { t } = useGlobalContext();
    const { pair } = useCreateContext();

    return (
        <Show when={pair().maxRoutingFee !== undefined}>
            <span class="fees-extra-line">
                {props.addLineBreak && <br />}
                {t("routing_fee_limit")}:{" "}
                <span data-testid="routing-fee-limit">
                    {pair().maxRoutingFee * ppmFactor} ppm
                </span>
            </span>
        </Show>
    );
};

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
    });

    return (
        <div class="fees-dyn">
            <div class="fees-dyn-denom">
                <Denomination />
            </div>
            <div class="fees-dyn-right">
                <Show
                    when={
                        !isUsdt0Asset(assetSend()) &&
                        !isUsdt0Asset(assetReceive())
                    }
                    fallback={<FeesCollapse />}>
                    <label>
                        {t("network_fee")}:{" "}
                        <span class="fee-amount">
                            <span class="network-fee" data-testid="network-fee">
                                {formatAmount(
                                    BigNumber(minerFee()),
                                    denomination(),
                                    separator(),
                                    BTC,
                                    true,
                                )}
                            </span>
                            <AmountDenominator value={denomination()} />
                        </span>
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
                            {boltzFee().toString().replaceAll(".", separator())}
                            %
                        </span>
                        ):{" "}
                        <span class="fee-amount">
                            <span class="boltz-fee" data-testid="boltz-fee">
                                {formatAmount(
                                    boltzFeeAmount(),
                                    denomination(),
                                    separator(),
                                    BTC,
                                    true,
                                )}
                            </span>
                            <AmountDenominator value={denomination()} />
                        </span>
                        <RoutingFee addLineBreak={true} />
                    </label>
                </Show>
            </div>
        </div>
    );
};

export default Fees;
