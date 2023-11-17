import DownloadRefund from "../components/DownloadRefund";
import EthereumTransaction from "../components/EthereumTransaction.jsx";
import { RBTC } from "../consts.js";
import { useWeb3Signer } from "../context/Web3.jsx";
import { clipboard } from "../helper";
import t from "../i18n";
import {
    asset,
    denomination,
    invoiceQr,
    setSwaps,
    swap,
    swaps,
} from "../signals";
import { formatAmount } from "../utils/denomination";
import { prefix0x, satoshiToWei } from "../utils/ethereum";
import { decodeInvoice } from "../utils/validation";

const InvoiceSet = () => {
    if (asset() === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <EthereumTransaction
                onClick={async () => {
                    const contract = await getEtherSwap();

                    const tx = await contract.lock(
                        prefix0x(decodeInvoice(swap().invoice).preimageHash),
                        swap().claimAddress,
                        swap().timeoutBlockHeight,
                        {
                            value: satoshiToWei(swap().expectedAmount),
                        },
                    );

                    const swapsTmp = swaps();
                    const currentSwap = swapsTmp.find(
                        (s) => swap().id === s.id,
                    );
                    currentSwap.lockupTx = tx.hash;
                    setSwaps(swapsTmp);
                }}
                promptText={t("send_prompt")}
                buttonText={t("send")}
                waitingText={t("tx_in_mempool_subline")}
                showHr={false}
            />
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
