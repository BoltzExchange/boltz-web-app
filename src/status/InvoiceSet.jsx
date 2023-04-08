import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { reverse, invoiceQr, swap } from "../signals";
import { downloadRefundFile, fetchSwapStatus, clipboard } from "../helper";

const InvoiceSet = () => {
    const [t, { add, locale, dict }] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
            <p>
              {t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight} <br />
              {t("pay_expected_amount")}: {swap().expectedAmount}
            </p>
            <hr />
            <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
            <hr />
            <span class="btn" onclick={() => clipboard(swap().bip21, t("copied"))}>{t("copy_bip21")}</span>
            <span class="btn" onclick={() => clipboard(swap().address, t("copied"))}>{t("copy_onchain")}</span>
            <span class="btn" onclick={() => clipboard(swap().expectedAmount, t("copied"))}>{t("copy_amount")}</span>
            <span class="btn btn-success" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
            <span class="btn btn-success" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
        </div>
    );
};

export default InvoiceSet;
