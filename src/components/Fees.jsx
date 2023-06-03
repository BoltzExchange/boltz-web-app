import { createSignal, createEffect, onCleanup } from "solid-js";
import { useI18n } from "@solid-primitives/i18n";
import log from "loglevel";
import {
    config,
    reverse,
    asset,
    setMaximum,
    setMinimum,
    setBoltzFee,
    setMinerFee,
    setReceiveAmount,
    setSendAmount,
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
import { fetchPairs } from "../helper";
import btc_svg from "../assets/btc.svg";
import sat_svg from "../assets/sat.svg";
import reload_svg from "../assets/reload.svg";

const Fees = () => {
    const [firstLoad, setFirstLoad] = createSignal(true);

    createEffect(() => {
        let cfg = config()["BTC/BTC"];
        if (asset() === "L-BTC") {
            cfg = config()["L-BTC/BTC"];
        }
        if (cfg) {
            setMinimum(cfg.limits.minimal);
            setMaximum(cfg.limits.maximal);
            if (reverse()) {
                let rev = cfg.fees.minerFees.baseAsset.reverse;
                let fee = rev.claim + rev.lockup;
                setBoltzFee(cfg.fees.percentage);
                setMinerFee(fee);
            } else {
                let fee = cfg.fees.minerFees.baseAsset.normal;
                setBoltzFee(cfg.fees.percentageSwapIn);
                setMinerFee(fee);
            }
            if (firstLoad() && sendAmount() === BigInt(0)) {
                setFirstLoad(false);
                setReceiveAmount(BigInt(cfg.limits.minimal));
                setSendAmount(BigInt(calculateSendAmount(cfg.limits.minimal)));
            }
        }
    });

    let timer = setInterval(() => {
        log.debug("tick Fees");
        fetchPairs();
    }, 30000);

    onCleanup(() => {
        log.debug("cleanup Fees");
        clearInterval(timer);
    });

    fetchPairs();

    const [t] = useI18n();

    return (
        <div class="fees-dyn">
            <div class="denomination">
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
