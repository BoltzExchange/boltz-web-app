import { BigNumber } from "bignumber.js";
import { Show, createMemo, createResource } from "solid-js";

import CopyButton from "../components/CopyButton";
import QrCode from "../components/QrCode";
import { BTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { getPairs } from "../utils/boltzClient";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { clipboard, cropString, getPair, isMobile } from "../utils/helper";
import LoadingSpinner from "./LoadingSpinner";

const PayOnchain = (props: {
    type: SwapType;
    assetSend: string;
    assetReceive: string;
    expectedAmount: number;
    address: string;
    bip21: string;
}) => {
    const { t, denomination, separator, setPairs, pairs } = useGlobalContext();

    const [pairsFetch] = createResource(async () => {
        if (pairs() !== undefined) {
            return pairs();
        }

        const p = await getPairs();
        setPairs(p);
        return p;
    });

    const headerText = createMemo(() => {
        const denom = formatDenomination(denomination(), props.assetSend);

        if (props.expectedAmount > 0) {
            return t("send_to", {
                denomination: denom,
                amount: formatAmount(
                    BigNumber(props.expectedAmount),
                    denomination(),
                    separator(),
                ),
            });
        }

        if (pairs() === undefined) {
            return "";
        }

        const pair = getPair(
            pairs(),
            props.type,
            props.assetSend,
            props.assetReceive,
        );
        return t("send_between", {
            denomination: denom,
            min: formatAmount(
                BigNumber(pair.limits.minimal),
                denomination(),
                separator(),
            ),
            max: formatAmount(
                BigNumber(pair.limits.maximal),
                denomination(),
                separator(),
            ),
        });
    });

    return (
        <Show
            when={!pairsFetch.loading || headerText() === ""}
            fallback={<LoadingSpinner />}>
            <div>
                <h2>{headerText()}</h2>
                <hr />
                <a href={props.bip21}>
                    <QrCode asset={props.assetSend} data={props.bip21} />
                </a>
                <hr />
                <p
                    onClick={() => clipboard(props.address)}
                    class="address-box break-word">
                    {cropString(props.address)}
                </p>
                <Show when={props.assetSend === BTC}>
                    <hr class="spacer" />
                    <h3>{t("warning_expiry")}</h3>
                </Show>
                <Show when={isMobile()}>
                    <hr />
                    <a href={props.bip21} class="btn btn-light">
                        {t("open_in_wallet")}
                    </a>
                </Show>
                <hr />
                <div class="btns" data-testid="pay-onchain-buttons">
                    <Show when={props.expectedAmount > 0}>
                        <CopyButton
                            label="copy_amount"
                            data={() =>
                                formatAmount(
                                    BigNumber(props.expectedAmount),
                                    denomination(),
                                    separator(),
                                )
                            }
                        />
                    </Show>

                    <CopyButton label="copy_address" data={props.address} />
                    <CopyButton label="copy_bip21" data={props.bip21} />
                </div>
            </div>
        </Show>
    );
};

export default PayOnchain;
