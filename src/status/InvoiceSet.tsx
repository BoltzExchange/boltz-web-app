import { BigNumber } from "bignumber.js";
import { Show } from "solid-js";

import ContractTransaction from "../components/ContractTransaction";
import QrCode from "../components/QrCode";
import { BTC, RBTC } from "../consts";
import { useAppContext } from "../context/App";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { denominations, formatAmount } from "../utils/denomination";
import {
    clipboard,
    cropString,
    isBoltzClient,
    isMobile,
} from "../utils/helper";
import { invoice, rootstock } from "../utils/lazy";

const ClaimRootstock = () => {
    const { swap, swaps, setSwaps } = useAppContext();
    const { t } = useGlobalContext();
    const { getEtherSwap } = useWeb3Signer();

    return (
        <ContractTransaction
            onClick={async () => {
                const contract = await getEtherSwap();

                const tx = await contract.lock(
                    rootstock.prefix0x(
                        invoice.decodeInvoice(swap().invoice).preimageHash,
                    ),
                    swap().claimAddress,
                    swap().timeoutBlockHeight,
                    {
                        value: rootstock.satoshiToWei(swap().expectedAmount),
                    },
                );

                const swapsTmp = swaps();
                const currentSwap = swapsTmp.find((s) => swap().id === s.id);
                currentSwap.lockupTx = tx.hash;
                setSwaps(swapsTmp);
            }}
            buttonText={t("send")}
            promptText={t("transaction_prompt", { button: t("send") })}
            waitingText={t("tx_in_mempool_subline")}
            showHr={false}
        />
    );
};

const InvoiceSet = ({
    bip21,
    address,
    amount,
}: {
    bip21: string;
    address: string;
    amount: number;
}) => {
    const { asset } = usePayContext();
    const { t, denomination } = useGlobalContext();

    if (asset() === RBTC && !isBoltzClient()) {
        return <ClaimRootstock />;
    }

    const formattedAmount = formatAmount(BigNumber(amount), denomination());

    return (
        <div>
            <h2>
                {t("send_to", {
                    amount: formattedAmount,
                    denomination:
                        denomination() === denominations.sat ? "sats" : asset,
                })}
            </h2>
            <hr />
            <a href={bip21}>
                <QrCode data={bip21} />
            </a>
            <hr />
            <p
                onclick={() => clipboard(address)}
                class="address-box break-word">
                {cropString(address)}
            </p>
            <hr class="spacer" />
            <Show when={asset() === BTC}>
                <h3>{t("warning_expiry")}</h3>
                <hr />
            </Show>
            <Show when={isMobile}>
                <a href={bip21} class="btn btn-light">
                    {t("open_in_wallet")}
                </a>
            </Show>
            <hr />
            <div class="btns">
                <span class="btn" onclick={() => clipboard(formattedAmount)}>
                    {t("copy_amount")}
                </span>
                <span class="btn" onclick={() => clipboard(address)}>
                    {t("copy_address")}
                </span>
                <span class="btn" onclick={() => clipboard(bip21)}>
                    {t("copy_bip21")}
                </span>
            </div>
        </div>
    );
};

export default InvoiceSet;
