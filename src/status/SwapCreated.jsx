import log from 'loglevel';
import { useI18n } from "@solid-primitives/i18n";
import { invoiceQr, swap, webln } from "../signals";
import { fetchSwapStatus } from "../helper";

const SwapCreated = () => {
    const [t] = useI18n();

    const payWeblnInvoice = async (pr) => {
        let check_enable = await window.webln.enable();
        if (check_enable.enabled) {
            const result = await window.webln.sendPayment(pr);
            log.debug("webln payment result:", result);
            fetchSwapStatus(swap());
        }
    };

    return (
        <div>
            <p>{t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight}</p>
            <hr />
            <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
            <hr />
            <Show when={webln()}>
              <span class="btn btn-light" onClick={() => payWeblnInvoice(swap().invoice)}>{t("pay_invoice_webln")}</span>
            </Show>
            <span class="btn" onclick={() => navigator.clipboard.writeText(swap().invoice)}>{t("copy_invoice")}</span>
        </div>
    );
};

export default SwapCreated;
