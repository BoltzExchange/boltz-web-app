import { BigNumber } from "bignumber.js";
import { createEffect } from "solid-js";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import {
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "../utils/boltzClient";
import {
    calculateBoltzFeeOnSend,
    calculateSendAmount,
} from "../utils/calculate";
import { formatAmount } from "../utils/denomination";
import { getPair } from "../utils/helper";

const Fees = () => {
    const { t, pairs, fetchPairs, denomination, separator } = useGlobalContext();
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

    fetchPairs();

    return (
        <div class="fees">
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
                        data-denominator={denomination()}></span>
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
                            reverse(),
                        ),
                        denomination(),
                        separator(),
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
