import { BigNumber } from "bignumber.js";
import log from "loglevel";
import { Show } from "solid-js";

import QrCode from "../components/QrCode";
import { BTC } from "../consts";
import t from "../i18n";
import { denomination, swap, webln } from "../signals";
import { denominations, formatAmount } from "../utils/denomination";
import { clipboard, cropString } from "../utils/helper";
import { enableWebln } from "../utils/webln";

const SwapCreated = () => {
    const payWeblnInvoice = async (pr: string) => {
        enableWebln(async () => {
            const result = await window.webln.sendPayment(pr);
            log.debug("webln payment result:", result);
        });
    };

    return (
        <div>
            <h2>
                {t("pay_invoice_to", {
                    amount: formatAmount(
                        BigNumber(swap().sendAmount),
                        denomination(),
                    ),
                    denomination:
                        denomination() === denominations.sat ? "sats" : BTC,
                })}
            </h2>
            <hr />
            <QrCode data={swap().reverse ? swap().invoice : swap().bip21} />
            <hr />
            <p
                onclick={() => clipboard(swap().invoice, t("copied"))}
                class="address-box break-word">
                {cropString(swap().invoice)}
            </p>
            <hr />
            <h3>{t("warning_return")}</h3>
            <hr />
            <Show when={webln()}>
                <span
                    class="btn btn-light"
                    onClick={() => payWeblnInvoice(swap().invoice)}>
                    {t("pay_invoice_webln")}
                </span>
            </Show>
            <span
                class="btn"
                onclick={() => clipboard(swap().invoice, t("copied"))}>
                {t("copy_invoice")}
            </span>
        </div>
    );
};

export default SwapCreated;
