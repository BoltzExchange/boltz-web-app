import { BigNumber } from "bignumber.js";
import { Show } from "solid-js";

import CopyButton from "../components/CopyButton";
import QrCode from "../components/QrCode";
import { BTC } from "../consts/Assets";
import { Denomination } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { formatAmount } from "../utils/denomination";
import { clipboard, cropString, isMobile } from "../utils/helper";

const PayOnchain = (props: {
    asset: string;
    expectedAmount: number;
    address: string;
    bip21: string;
}) => {
    const { t, denomination, separator } = useGlobalContext();

    return (
        <div>
            <h2>
                {t("send_to", {
                    amount: formatAmount(
                        BigNumber(props.expectedAmount),
                        denomination(),
                        separator(),
                    ),
                    denomination:
                        denomination() === Denomination.Sat
                            ? "sats"
                            : props.asset,
                })}
            </h2>
            <hr />
            <a href={props.bip21}>
                <QrCode asset={props.asset} data={props.bip21} />
            </a>
            <hr />
            <p
                onClick={() => clipboard(props.address)}
                class="address-box break-word">
                {cropString(props.address)}
            </p>
            <Show when={props.asset === BTC}>
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
                <CopyButton label="copy_address" data={props.address} />
                <CopyButton label="copy_bip21" data={props.bip21} />
            </div>
        </div>
    );
};

export default PayOnchain;
