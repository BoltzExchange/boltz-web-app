import { BigNumber } from "bignumber.js";
import log from "loglevel";
import { Show } from "solid-js";

import QrCode from "../components/QrCode";
import { BTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { denominations, formatAmount } from "../utils/denomination";
import { clipboard, cropString, isMobile } from "../utils/helper";
import { decodeInvoice, invoicePrefix } from "../utils/invoice";
import { enableWebln } from "../utils/webln";

const SwapCreated = ({ invoice }: { invoice: string }) => {
    const { t, denomination, webln } = useGlobalContext();
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
                        BigNumber(decodeInvoice(invoice).satoshis),
                        denomination(),
                    ),
                    denomination:
                        denomination() === denominations.sat ? "sats" : BTC,
                })}
            </h2>
            <hr />
            <a href={invoicePrefix + invoice}>
                <QrCode data={invoice} />
            </a>
            <hr />
            <p
                onclick={() => clipboard(invoice)}
                class="address-box break-word">
                {cropString(invoice)}
            </p>
            <hr />
            <h3>{t("warning_return")}</h3>
            <hr />
            <Show when={webln() && !isMobile}>
                <span
                    class="btn btn-light"
                    onClick={() => payWeblnInvoice(invoice)}>
                    {t("pay_invoice_webln")}
                </span>
            </Show>
            <Show when={isMobile}>
                <a href={invoicePrefix + invoice} class="btn btn-light">
                    {t("open_in_wallet")}
                </a>
            </Show>
            <hr class="spacer" />
            <span class="btn" onclick={() => clipboard(invoice)}>
                {t("copy_invoice")}
            </span>
        </div>
    );
};

export default SwapCreated;
