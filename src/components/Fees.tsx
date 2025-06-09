import { BigNumber } from "bignumber.js";
import {
    Show,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onMount,
} from "solid-js";

import { config } from "../config";
import { LBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import type {
    ChainPairTypeTaproot,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "../utils/boltzClient";
import {
    calculateBoltzFeeOnSend,
    calculateSendAmount,
} from "../utils/calculate";
import { isConfidentialAddress } from "../utils/compat";
import { formatAmount } from "../utils/denomination";
import { getPair } from "../utils/helper";
import { weiToSatoshi } from "../utils/rootstock";
import { getClaimAddress } from "./CreateButton";
import Denomination from "./settings/Denomination";

const ppmFactor = 10_000;

// When sending to an unconfidential address, we need to add an extra
// confidential OP_RETURN output with 1 sat inside
const unconfidentialExtra = 5;

const rifExtraGasCost = 157_000n;

export const getFeeHighlightClass = (fee: number, regularFee: number) => {
    if (fee < 0) {
        return "negative-fee";
    }

    if (fee >= 0 && fee < regularFee) {
        return "lower-fee";
    }

    return "";
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
        assetSend,
        assetReceive,
        swapType,
        sendAmount,
        setMaximum,
        setMinimum,
        minerFee,
        setMinerFee,
        boltzFee,
        setBoltzFee,
        onchainAddress,
        addressValid,
    } = useCreateContext();
    const { signer } = useWeb3Signer();

    const isToUnconfidentialLiquid = () =>
        assetReceive() === LBTC &&
        addressValid() &&
        !isConfidentialAddress(onchainAddress());

    const [routingFee, setRoutingFee] = createSignal<number | undefined>(
        undefined,
    );

    const rifFetchTrigger = createMemo(() => {
        return {
            signer: signer(),
            assetReceive: assetReceive(),
        };
    });
    const [rifExtraCost] = createResource(
        rifFetchTrigger,
        async ({ signer, assetReceive }) => {
            if (signer === undefined) {
                return 0;
            }

            const { useRif, gasPrice } = await getClaimAddress(
                () => assetReceive,
                () => signer,
                onchainAddress,
            );
            if (!useRif) {
                return 0;
            }

            notify("success", t("rif_extra_fee"));
            return Number(weiToSatoshi(gasPrice * rifExtraGasCost));
        },
        { initialValue: 0 },
    );

    createEffect(() => {
        // Reset routing fee when changing the pair
        // (which might not be submarine and not set the signal)
        setRoutingFee(undefined);

        // Updating the miner fee with "setMinerFee(minerFee() + rifExtraCost())"
        // causes an endless loop of triggering the effect again
        const updateMinerFee = (fee: number) => {
            setMinerFee(fee + rifExtraCost());
        };

        if (pairs()) {
            const cfg = getPair(
                pairs(),
                swapType(),
                assetSend(),
                assetReceive(),
            );

            if (!cfg) return;

            setBoltzFee(cfg.fees.percentage);

            switch (swapType()) {
                case SwapType.Submarine:
                    setRoutingFee(
                        (cfg as SubmarinePairTypeTaproot).fees
                            .maximalRoutingFee,
                    );
                    updateMinerFee(
                        (cfg as SubmarinePairTypeTaproot).fees.minerFees,
                    );
                    break;

                case SwapType.Reverse: {
                    const reverseCfg = cfg as ReversePairTypeTaproot;
                    let fee =
                        reverseCfg.fees.minerFees.claim +
                        reverseCfg.fees.minerFees.lockup;
                    if (isToUnconfidentialLiquid()) {
                        fee += unconfidentialExtra;
                    }

                    updateMinerFee(fee);
                    break;
                }

                case SwapType.Chain: {
                    const chainCfg = cfg as ChainPairTypeTaproot;
                    let fee =
                        chainCfg.fees.minerFees.server +
                        chainCfg.fees.minerFees.user.claim;
                    if (isToUnconfidentialLiquid()) {
                        fee += unconfidentialExtra;
                    }

                    updateMinerFee(fee);
                    break;
                }
            }

            const calculateLimit = (limit: number): number => {
                return swapType() === SwapType.Submarine
                    ? calculateSendAmount(
                          BigNumber(limit),
                          boltzFee(),
                          minerFee(),
                          swapType(),
                      ).toNumber()
                    : limit;
            };

            setMinimum(
                calculateLimit(
                    (cfg as SubmarinePairTypeTaproot).limits.minimalBatched ||
                        cfg.limits.minimal,
                ),
            );
            setMaximum(calculateLimit(cfg.limits.maximal));
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
            <Denomination />
            <label>
                {t("network_fee")}:{" "}
                <span class="network-fee">
                    {formatAmount(
                        BigNumber(minerFee()),
                        denomination(),
                        separator(),
                        true,
                    )}
                    <span
                        class="denominator"
                        data-denominator={denomination()}
                    />
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
                    {boltzFee().toString().replaceAll(".", separator())}%
                </span>
                ):{" "}
                <span class="boltz-fee">
                    {formatAmount(
                        calculateBoltzFeeOnSend(
                            sendAmount(),
                            boltzFee(),
                            minerFee(),
                            swapType(),
                        ),
                        denomination(),
                        separator(),
                        true,
                    )}
                    <span
                        class="denominator"
                        data-denominator={denomination()}
                    />
                </span>
                <Show when={routingFee() !== undefined}>
                    <br />
                    {t("routing_fee_limit")}:{" "}
                    <span data-testid="routing-fee-limit">
                        {routingFee() * ppmFactor} ppm
                    </span>
                </Show>
            </label>
        </div>
    );
};

export default Fees;
