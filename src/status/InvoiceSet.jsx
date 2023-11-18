import DownloadRefund from "../components/DownloadRefund";
import { clipboard, cropString } from "../helper";
import t from "../i18n";
import { invoiceQr, swap } from "../signals";
import { formatAmount } from "../utils/denomination";

const InvoiceSet = () => {
    return (
        <div>
            <h2>
                {t("send_to", {
                    amount: formatAmount(swap().expectedAmount),
                    asset: swap().asset,
                })}
            </h2>
            <hr />
            <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
            <hr />
            <p
                onclick={() => clipboard(swap().address, t("copied"))}
                class="address-box break-word">
                {cropString(swap().address)}
            </p>
            <hr />
            <h3>{t("warning_expiry")}</h3>
            <hr />
            <div class="btns">
                <span
                    class="btn"
                    onclick={() => clipboard(swap().bip21, t("copied"))}>
                    {t("copy_bip21")}
                </span>
                <span
                    class="btn"
                    onclick={() =>
                        clipboard(
                            formatAmount(swap().expectedAmount),
                            t("copied"),
                        )
                    }>
                    {t("copy_amount")}
                </span>
                <span
                    class="btn"
                    onclick={() => clipboard(swap().address, t("copied"))}>
                    {t("copy_address")}
                </span>
            </div>
            <hr />
            <DownloadRefund />
        </div>
    );
};

export default InvoiceSet;
