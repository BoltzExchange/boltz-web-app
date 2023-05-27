import { useI18n } from "@solid-primitives/i18n";
import { invoiceQr, swap } from "../signals";
import { clipboard } from "../helper";
import { formatAmount } from "../utils/denomination";
import DownloadRefund from "../components/DownloadRefund";

const InvoiceSet = () => {
    const [t] = useI18n();

    return (
        <div>
            <p>
                {t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight}{" "}
                <br />
                {t("pay_expected_amount")}:{" "}
                {formatAmount(swap().expectedAmount)}
            </p>
            <hr />
            <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
            <hr />
            <div class="btns">
                <span
                    class="btn"
                    onclick={() => clipboard(swap().bip21, t("copied"))}>
                    {t("copy_bip21")}
                </span>
                <span
                    class="btn"
                    onclick={() => clipboard(swap().address, t("copied"))}>
                    {t("copy_address")}
                </span>
                <span
                    class="btn"
                    onclick={() =>
                        clipboard(
                            formatAmount(swap().expectedAmount),
                            t("copied")
                        )
                    }>
                    {t("copy_amount")}
                </span>
            </div>
            <div class="btns">
                <DownloadRefund />
            </div>
        </div>
    );
};

export default InvoiceSet;
