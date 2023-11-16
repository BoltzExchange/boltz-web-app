import DownloadRefund from "../components/DownloadRefund";
import { clipboard } from "../helper";
import t from "../i18n";
import { invoiceQr, swap, denomination } from "../signals";
import { formatAmount } from "../utils/denomination";

const InvoiceSet = () => {
    return (
        <div>
            <p>
                {t("send_to_desc", {
                    amount: formatAmount(swap().expectedAmount),
                    denomination: denomination(),
                    blockheight: swap().timeoutBlockHeight,
                })}
                <br />
            </p>
            <hr />
            <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
            <hr />
            <h2>
                {t("send_to", {
                    amount: formatAmount(swap().expectedAmount),
                    denomination: denomination(),
                })}
            </h2>
            <p
                onclick={() => clipboard(swap().address, t("copied"))}
                class="address-box break-word">
                {swap().address}
            </p>
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
