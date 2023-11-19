import DownloadRefund from "../components/DownloadRefund";
import EthereumTransaction from "../components/EthereumTransaction";
import { RBTC } from "../consts";
import { useWeb3Signer } from "../context/Web3";
import { clipboard, cropString } from "../helper";
import t from "../i18n";
import {
    asset,
    denomination,
    invoiceQr,
    setSwaps,
    swap,
    swaps,
} from "../signals";
import { denominations, formatAmount } from "../utils/denomination";
import { prefix0x, satoshiToWei } from "../utils/ethereum";
import { decodeInvoice } from "../utils/invoice";

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
                buttonText={t("send")}
                promptText={t("transaction_prompt", { button: t("send") })}
                waitingText={t("tx_in_mempool_subline")}
                showHr={false}
            />
        );
    }

    return (
        <div>
            <h2>
                {t("send_to", {
                    amount: formatAmount(swap().expectedAmount),
                    denomination:
                        denomination() === denominations.sat
                            ? "sats"
                            : swap().asset,
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
