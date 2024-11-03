import { BigNumber } from "bignumber.js";
import { createEffect } from "solid-js";

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
            </label>
        </div>
    );
};

export default Fees;
