import { createEffect, Show } from "solid-js";
import t from "../i18n";
import btcSvg from "../assets/btc.svg";
import satSvg from "../assets/sat.svg";
import { formatAmount } from "../utils/denomination";
import { isMobile, fetchPairs } from "../helper";
import {
    config,
    reverse,
    asset,
    setMaximum,
    setMinimum,
    setBoltzFee,
    setMinerFee,
    sendAmount,
    denomination,
    setDenomination,
    boltzFee,
    minerFee,
} from "../signals";
import {
    calculateBoltzFeeOnSend,
    calculateSendAmount,
} from "../utils/calculate";

const Fees = () => {
    createEffect(() => {
        let cfg = config()["BTC/BTC"];
        if (asset() === "L-BTC") {
            cfg = config()["L-BTC/BTC"];
        }
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

            const calculateLimit = (limit) => {
                return reverse() ? limit : calculateSendAmount(limit);
            };

            setMinimum(calculateLimit(cfg.limits.minimal));
            setMaximum(calculateLimit(cfg.limits.maximal));
        }
    });

    fetchPairs();

    return (
        <div class="fees-dyn">
            <div class="denomination">
                <Show when={!isMobile}>
                    <label>{t("denomination")}: </label>
                </Show>
                <img
                    src={btcSvg}
                    onClick={() => setDenomination("btc")}
                    class={denomination() == "btc" ? "active" : ""}
                    alt="denominator"
                />
                <img
                    src={satSvg}
                    onClick={() => setDenomination("sat")}
                    class={denomination() == "sat" ? "active" : ""}
                    alt="denominator"
                />
            </div>
            <label>
                {t("network_fee")}:{" "}
                <span class="network-fee">
                    {formatAmount(minerFee(), true)}
                    <span
                        class="denominator"
                        data-denominator={denomination()}></span>
                </span>
                <br />
                {t("fee")} ({boltzFee()}%):{" "}
                <span class="boltz-fee">
                    {formatAmount(calculateBoltzFeeOnSend(sendAmount()), true)}
                    <span
                        class="denominator"
                        data-denominator={denomination()}></span>
                </span>
            </label>
        </div>
    );
};

export default Fees;
