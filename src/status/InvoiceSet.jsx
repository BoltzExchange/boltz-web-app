import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { reverse, invoiceQr, swap } from "./signals";
import { downloadRefundFile, fetchSwapStatus, clipboard } from "./helper";

const InvoiceSet = () => {
    const [t, { add, locale, dict }] = useI18n();

    const navigate = useNavigate();

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
        <p>
        {t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight} <br />
        <Show when={!reverse()}>
        {t("pay_expected_amount")}: {swap().expectedAmount} <br />
        </Show>
        </p>
        <hr />
        <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
        <hr />
        <Show when={!reverse()}>
        <span class="btn" onclick={() => clipboard(swap().bip21, t("copied"))}>{t("copy_bip21")}</span>
        <span class="btn" onclick={() => clipboard(swap().address, t("copied"))}>{t("copy_onchain")}</span>
        <span class="btn" onclick={() => clipboard(swap().expectedAmount, t("copied"))}>{t("copy_amount")}</span>
        <span class="btn btn-success" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
        <span class="btn btn-success" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
        </Show>
        <Show when={reverse()}>
        <Show when={webln()}>
        <span class="btn btn-light" onClick={(e) => payWeblnInvoice(swap().invoice)}>{t("pay_invoice_webln")}</span>
        </Show>
        <span class="btn" onclick={() => navigator.clipboard.writeText(swap().invoice)}>{t("copy_invoice")}</span>
        </Show>
        </div>
    );
};

export default InvoiceSet;
