import { createEffect } from "solid-js";
import { useI18n } from "@solid-primitives/i18n";
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
import { formatAmount } from "../utils/denomination";
import {
    calculateBoltzFeeOnSend,
    calculateSendAmount,
} from "../utils/calculate";
import { isMobile, fetchPairs } from "../helper";
import btc_svg from "../assets/btc.svg";
import sat_svg from "../assets/sat.svg";

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

    const [t] = useI18n();

    return (
        <div class="fees-dyn">
            <div class="denomination">
                <Show when={!isMobile}>
                    <label>{t("denomination")}: </label>
                </Show>
                <img
                    src={btc_svg}
                    onClick={() => setDenomination("btc")}
                    class={denomination() == "btc" ? "active" : ""}
                    alt="denominator"
                />
                <img
                    src={sat_svg}
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
