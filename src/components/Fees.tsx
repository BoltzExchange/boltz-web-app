import { BigNumber } from "bignumber.js";
import { createEffect } from "solid-js";

import btcSvg from "../assets/btc.svg";
import satSvg from "../assets/sat.svg";
import { config } from "../config";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import {
    calculateBoltzFeeOnSend,
    calculateSendAmount,
} from "../utils/calculate";
import { denominations, formatAmount } from "../utils/denomination";
import { getPair } from "../utils/helper";
import type {
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "../utils/types";

const Fees = () => {
    const { t, pairs, fetchPairs, denomination, setDenomination } =
        useGlobalContext();
    const {
        asset,
        reverse,
        sendAmount,
        setMaximum,
        setMinimum,
        minerFee,
        setMinerFee,
        boltzFee,
        setBoltzFee,
    } = useCreateContext();

    createEffect(() => {
        if (config().apiUrl) {
            fetchPairs(asset());
        }
    });

    createEffect(() => {
        if (pairs()) {
            const cfg = getPair(pairs(), asset(), reverse());

            if (reverse()) {
                const reverseCfg = cfg as ReversePairTypeTaproot;

                const fee =
                    reverseCfg.fees.minerFees.claim +
                    reverseCfg.fees.minerFees.lockup;

                setBoltzFee(reverseCfg.fees.percentage);
                setMinerFee(fee);
            } else {
                setBoltzFee(cfg.fees.percentage);
                setMinerFee((cfg as SubmarinePairTypeTaproot).fees.minerFees);
            }

            const calculateLimit = (limit: number): number => {
                return reverse()
                    ? limit
                    : calculateSendAmount(
                          BigNumber(limit),
                          boltzFee(),
                          minerFee(),
                          reverse(),
                      ).toNumber();
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
                        calculateBoltzFeeOnSend(
                            sendAmount(),
                            boltzFee(),
                            minerFee(),
                            reverse(),
                        ),
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
