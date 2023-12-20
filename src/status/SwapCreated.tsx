import { BigNumber } from "bignumber.js";
import log from "loglevel";
import { Show } from "solid-js";

import QrCode from "../components/QrCode";
import { BTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { denominations, formatAmount } from "../utils/denomination";
import { clipboard, cropString, isMobile } from "../utils/helper";
import { invoicePrefix } from "../utils/invoice";
import { enableWebln } from "../utils/webln";

const SwapCreated = () => {
    const { swap } = usePayContext();
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
                        BigNumber(swap().sendAmount),
                        denomination(),
                    ),
                    denomination:
                        denomination() === denominations.sat ? "sats" : BTC,
                })}
            </h2>
            <hr />
            <a href={invoicePrefix + swap().invoice}>
                <QrCode data={swap().invoice} />
            </a>
            <hr />
            <p
                onclick={() => clipboard(swap().invoice)}
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
            <hr class="spacer" />
            <div class="btns">
                <span class="btn" onclick={() => clipboard(swap().invoice)}>
                    {t("copy_invoice")}
                </span>
                <Show when={isMobile}>
                    <a href={invoicePrefix + swap().invoice} class="btn">
                        {t("open_in_wallet")}
                    </a>
                </Show>
            </div>
        </div>
    );
};

export default SwapCreated;
