import { BigNumber } from "bignumber.js";
import { Show, createEffect, createSignal } from "solid-js";

import { LBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import {
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
import Denomination from "./settings/Denomination";

const ppmFactor = 10_000;

// When sending to an unconfidential address, we need to add an extra
// confidential OP_RETURN output with 1 sat inside
const unconfidentialExtra = 5;

const Fees = () => {
    const { t, pairs, fetchPairs, denomination, separator } =
        useGlobalContext();
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

    const isToUnconfidentialLiquid = () =>
        assetReceive() === LBTC &&
        addressValid() &&
        !isConfidentialAddress(onchainAddress());

    const [routingFee, setRoutingFee] = createSignal<number | undefined>(
        undefined,
    );

    createEffect(() => {
        // Reset routing fee when changing the pair
        // (which might not be submarine and not set the signal)
        setRoutingFee(undefined);

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
                    setMinerFee(
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

                    setMinerFee(fee);
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

                    setMinerFee(fee);
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

            setMinimum(calculateLimit(cfg.limits.minimal));
            setMaximum(calculateLimit(cfg.limits.maximal));
        }
    });

    void fetchPairs();

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
                {t("fee")} ({boltzFee().toString().replaceAll(".", separator())}
                %):{" "}
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
