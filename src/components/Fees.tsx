import { BigNumber } from "bignumber.js";
import { createEffect } from "solid-js";

import btcSvg from "../assets/btc.svg";
import satSvg from "../assets/sat.svg";
import { fetchPairs } from "../helper";
import t from "../i18n";
import {
    asset,
    boltzFee,
    config,
    denomination,
    minerFee,
    reverse,
    sendAmount,
    setBoltzFee,
    setDenomination,
    setMaximum,
    setMinerFee,
    setMinimum,
} from "../signals";
import {
    calculateBoltzFeeOnSend,
    calculateSendAmount,
} from "../utils/calculate";
import { denominations, formatAmount } from "../utils/denomination";

const Fees = () => {
    createEffect(() => {
        const cfg = config()[`${asset()}/BTC`];

        if (cfg) {
            if (reverse()) {
                const rev = cfg.fees.minerFees.baseAsset.reverse;
                const fee = rev.claim + rev.lockup;
                setBoltzFee(cfg.fees.percentage);
                setMinerFee(fee);
            } else {
                let fee = cfg.fees.minerFees.baseAsset.normal;
                setBoltzFee(cfg.fees.percentageSwapIn);
                setMinerFee(fee);
            }

            const calculateLimit = (limit: number) => {
                return reverse() ? limit : calculateSendAmount(limit);
            };

            setMinimum(calculateLimit(cfg.limits.minimal));
            setMaximum(calculateLimit(cfg.limits.maximal));
        }
    });

    const toggleDenomination = () => {
        setDenomination(
            denomination() === denominations.btc
                ? denominations.sat
                : denominations.btc,
        );
    };

    fetchPairs();

    return (
        <div class="fees-dyn">
            <div class="denomination" onClick={() => toggleDenomination()}>
                <img
                    src={btcSvg}
                    class={denomination() == "btc" ? "active" : ""}
                    alt="denominator"
                />
                <img
                    src={satSvg}
                    class={denomination() == "sat" ? "active" : ""}
                    alt="denominator"
                />
            </div>
            <label>
                {t("network_fee")}:{" "}
                <span class="network-fee">
                    {formatAmount(BigNumber(minerFee()), denomination(), true)}
                    <span
                        class="denominator"
                        data-denominator={denomination()}></span>
                </span>
                <br />
                {t("fee")} ({boltzFee()}%):{" "}
                <span class="boltz-fee">
                    {formatAmount(
                        BigNumber(calculateBoltzFeeOnSend(sendAmount())),
                        denomination(),
                        true,
                    )}
                    <span
                        class="denominator"
                        data-denominator={denomination()}></span>
                </span>
            </label>
        </div>
    );
};

export default Fees;
