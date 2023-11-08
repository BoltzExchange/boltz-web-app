import t from "../i18n";
import { RBTC } from "../consts.js";
import { clipboard } from "../helper";
import { useWeb3Signer } from "../context/Web3.jsx";
import { decodeInvoice } from "../utils/validation";
import { formatAmount } from "../utils/denomination";
import DownloadRefund from "../components/DownloadRefund";
import { prefix0x, satoshiToWei } from "../utils/ethereum";
import { invoiceQr, swap, denomination, asset } from "../signals";

const InvoiceSet = () => {
    if (asset() === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <button
                class="btn"
                onClick={async () => {
                    const contract = await getEtherSwap();

                    await contract.lock(
                        prefix0x(decodeInvoice(swap().invoice).preimageHash),
                        swap().claimAddress,
                        swap().timeoutBlockHeight,
                        {
                            value: satoshiToWei(swap().expectedAmount),
                        },
                    );
                }}>
                Send
            </button>
        );
    }

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
