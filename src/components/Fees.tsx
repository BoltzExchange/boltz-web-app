import { BigNumber } from "bignumber.js";
import type { Accessor } from "solid-js";
import {
    Show,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onMount,
} from "solid-js";

import { config } from "../config";
import { LBTC } from "../consts/Assets";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { isConfidentialAddress } from "../utils/compat";
import { formatAmount } from "../utils/denomination";
import { weiToSatoshi } from "../utils/rootstock";
import { getClaimAddress } from "./CreateButton";
import Denomination from "./settings/Denomination";

const ppmFactor = 10_000;

// When sending to an unconfidential address, we need to add an extra
// confidential OP_RETURN output with 1 sat inside
export const unconfidentialExtra = 5;

const rifExtraGasCost = 157_000n;

export const getFeeHighlightClass = (fee: number, regularFee: number) => {
    if (fee < 0) {
        return "negative-fee";
    }

    if (fee >= 0 && fee < regularFee) {
        return "lower-fee";
    }

    return "";
};

export const isToUnconfidentialLiquid = ({
    assetReceive,
    addressValid,
    onchainAddress,
}: {
    assetReceive: Accessor<string>;
    addressValid: Accessor<boolean>;
    onchainAddress: Accessor<string>;
}) =>
    assetReceive() === LBTC &&
    addressValid() &&
    !isConfidentialAddress(onchainAddress());

const Fees = () => {
    const {
        t,
        pairs,
        fetchPairs,
        denomination,
        separator,
        notify,
        fetchRegularPairs,
    } = useGlobalContext();
    const {
        pair,
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
    const { signer } = useWeb3Signer();

    const [routingFee, setRoutingFee] = createSignal<number | undefined>(
        undefined,
    );

    const rifFetchTrigger = createMemo(() => {
        return {
            signer: signer(),
            assetReceive: pair().toAsset,
        };
    });
    const [rifExtraCost] = createResource(
        rifFetchTrigger,
        async ({ signer, assetReceive }) => {
            if (signer === undefined) {
                return 0;
            }

            const { useRif, gasPrice } = await getClaimAddress(
                () => assetReceive,
                () => signer,
                onchainAddress,
            );
            if (!useRif) {
                return 0;
            }

            notify("success", t("rif_extra_fee"));
            return Number(weiToSatoshi(gasPrice * rifExtraGasCost));
        },
        { initialValue: 0 },
    );

    createEffect(() => {
        // Updating the miner fee with "setMinerFee(minerFee() + rifExtraCost())"
        // causes an endless loop of triggering the effect again
        const updateMinerFee = (fee: number) => {
            setMinerFee(fee + rifExtraCost());
        };

        if (pairs()) {
            if (!pair().isRoutable) return;

            setBoltzFee(pair().feePercentage);
            setRoutingFee(pair().maxRoutingFee);

            let minerFees = pair().minerFees;
            if (
                isToUnconfidentialLiquid({
                    assetReceive: () => pair().toAsset,
                    addressValid,
                    onchainAddress,
                })
            ) {
                minerFees += unconfidentialExtra;
            }
            updateMinerFee(minerFees);

            setMinimum(pair().minimum);
            setMaximum(pair().maximum);
        }
    });

    void fetchPairs();

    onMount(() => {
        if (config.isPro) {
            void fetchRegularPairs();
        }
    });

    return (
        <div class="fees-dyn">
            <Denomination />
            <label>
                {t("network_fee")}:{" "}
                <span class="network-fee">
                    {formatAmount(
                        pair().fromAsset,
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
                {t("fee")} (
                <span
                    class={
                        config.isPro &&
                        getFeeHighlightClass(boltzFee(), pair().feeWithoutPro)
                    }>
                    {boltzFee().toString().replaceAll(".", separator())}%
                </span>
                ):{" "}
                <span class="boltz-fee">
                    {formatAmount(
                        pair().fromAsset,
                        pair().feeOnSend(sendAmount()),
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
