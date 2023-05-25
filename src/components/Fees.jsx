import { BigNumber } from "bignumber.js";
import { useI18n } from "@solid-primitives/i18n";
import {
    denomination,
    setDenomination,
    receiveAmount,
    boltzFee,
    minerFee,
} from "../signals";
import { formatAmount } from "../utils/denomination";
import { fetchPairs } from "../helper";
import btc_svg from "../assets/btc.svg";
import sat_svg from "../assets/sat.svg";
import reload_svg from "../assets/reload.svg";

const Fees = () => {
    const [t] = useI18n();
    return (
        <div class="fees-dyn">
            <div class="denomination">
                <label>{t("denomination")}: </label>
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
                <span class="icon-reload" onClick={fetchPairs}>
                    <img src={reload_svg} />
                </span>
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
                    {formatAmount(
                        Math.floor(
                            BigNumber(receiveAmount())
                                .multipliedBy(boltzFee())
                                .div(100)
                                .toNumber()
                        ),
                        true
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
