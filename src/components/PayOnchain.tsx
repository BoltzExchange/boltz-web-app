import { BigNumber } from "bignumber.js";
import { Show } from "solid-js";

import CopyButton from "../components/CopyButton";
import QrCode from "../components/QrCode";
import { BTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { denominations, formatAmount } from "../utils/denomination";
import { clipboard, cropString, isMobile } from "../utils/helper";

const PayOnchain = ({
    asset,
    expectedAmount,
    address,
    bip21,
}: {
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
                        BigNumber(expectedAmount),
                        denomination(),
                        separator(),
                    ),
                    denomination:
                        denomination() === denominations.sat ? "sats" : asset,
                })}
            </h2>
            <hr />
            <a href={bip21}>
                <QrCode asset={asset} data={bip21} />
            </a>
            <hr />
            <p
                onclick={() => clipboard(address)}
                class="address-box break-word">
                {cropString(address)}
            </p>
            <Show when={asset === BTC}>
                <hr class="spacer" />
                <h3>{t("warning_expiry")}</h3>
            </Show>
            <Show when={isMobile()}>
                <hr />
                <a href={bip21} class="btn btn-light">
                    {t("open_in_wallet")}
                </a>
            </Show>
            <hr />
            <div class="btns">
                <CopyButton
                    label="copy_amount"
                    data={formatAmount(
                        BigNumber(expectedAmount),
                        denomination(),
                        separator(),
                    )}
                />
                <CopyButton label="copy_address" data={address} />
                <CopyButton label="copy_bip21" data={bip21} />
            </div>
        </div>
    );
};

export default PayOnchain;
