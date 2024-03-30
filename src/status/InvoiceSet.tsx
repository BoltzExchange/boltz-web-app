import { BigNumber } from "bignumber.js";
import { Show } from "solid-js";

import ContractTransaction from "../components/ContractTransaction";
import CopyButton from "../components/CopyButton";
import QrCode from "../components/QrCode";
import { BTC, RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { denominations, formatAmount } from "../utils/denomination";
import { clipboard, cropString, isMobile } from "../utils/helper";
import { decodeInvoice } from "../utils/invoice";
import { prefix0x, satoshiToWei } from "../utils/rootstock";

const InvoiceSet = () => {
    const { swap } = usePayContext();
    const { asset } = useCreateContext();
    const { t, getSwap, setSwapStorage, denomination, separator } =
        useGlobalContext();

    if (asset() === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <ContractTransaction
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

                    const currentSwap = await getSwap(swap().id);
                    currentSwap.lockupTx = tx.hash;
                    await setSwapStorage(currentSwap);
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
                    amount: formatAmount(
                        BigNumber(swap().expectedAmount),
                        denomination(),
                        separator(),
                    ),
                    denomination:
                        denomination() === denominations.sat
                            ? "sats"
                            : swap().asset,
                })}
            </h2>
            <hr />
            <a href={swap().bip21}>
                <QrCode data={swap().bip21} />
            </a>
            <hr />
            <p
                onclick={() => clipboard(swap().address)}
                class="address-box break-word">
                {cropString(swap().address)}
            </p>
            <Show when={swap().asset === BTC}>
                <hr class="spacer" />
                <h3>{t("warning_expiry")}</h3>
            </Show>
            <Show when={isMobile}>
                <hr />
                <a href={swap().bip21} class="btn btn-light">
                    {t("open_in_wallet")}
                </a>
            </Show>
            <hr />
            <div class="btns">
                <CopyButton
                    label="copy_amount"
                    data={formatAmount(
                        BigNumber(swap().expectedAmount),
                        denomination(),
                        separator(),
                    )}
                />
                <CopyButton label="copy_address" data={swap().address} />
                <CopyButton label="copy_bip21" data={swap().bip21} />
            </div>
        </div>
    );
};

export default InvoiceSet;
