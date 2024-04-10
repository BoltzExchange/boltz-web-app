import { BigNumber } from "bignumber.js";
import { createEffect } from "solid-js";

import { LBTC } from "../consts";
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
import Denomination from "./Denomination";

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

    createEffect(() => {
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
                    setMinerFee(
                        (cfg as SubmarinePairTypeTaproot).fees.minerFees,
                    );
                    break;

                case SwapType.Reverse:
                    const reverseCfg = cfg as ReversePairTypeTaproot;

                    let fee =
                        reverseCfg.fees.minerFees.claim +
                        reverseCfg.fees.minerFees.lockup;

                    if (
                        assetReceive() === LBTC &&
                        addressValid() &&
                        !isConfidentialAddress(onchainAddress())
                    ) {
                        fee += 1;
                    }

                    setMinerFee(fee);
                    break;

                case SwapType.Chain:
                    const chainCfg = cfg as ChainPairTypeTaproot;
                    setMinerFee(
                        chainCfg.fees.minerFees.server +
                            chainCfg.fees.minerFees.user.lockup +
                            chainCfg.fees.minerFees.user.claim,
                    );
                    break;
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

    fetchPairs();

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
                            swapType(),
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
