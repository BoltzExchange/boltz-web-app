import { BigNumber } from "bignumber.js";
import { Show } from "solid-js";

import ContractTransaction from "../components/ContractTransaction";
import QrCode from "../components/QrCode";
import { BTC, RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { denominations, formatAmount } from "../utils/denomination";
import { clipboard, cropString } from "../utils/helper";
import { decodeInvoice } from "../utils/invoice";
import { prefix0x, satoshiToWei } from "../utils/rootstock";

const InvoiceSet = () => {
    const { swap } = usePayContext();
    const { asset } = useCreateContext();
    const { t, swaps, setSwaps, denomination } = useGlobalContext();
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
                    amount: formatAmount(
                        BigNumber(swap().expectedAmount),
                        denomination(),
                    ),
                    denomination:
                        denomination() === denominations.sat
                            ? "sats"
                            : swap().asset,
                })}
            </h2>
            <hr />
            <QrCode data={swap().reverse ? swap().invoice : swap().bip21} />
            <hr />
            <p
                onclick={() => clipboard(swap().address)}
                class="address-box break-word">
                {cropString(swap().address)}
            </p>
            <hr class="spacer" />
            <Show when={swap().asset === BTC}>
                <h3>{t("warning_expiry")}</h3>
                <hr />
            </Show>
            <div class="btns">
                <span class="btn" onclick={() => clipboard(swap().bip21)}>
                    {t("copy_bip21")}
                </span>
                <span
                    class="btn"
                    onclick={() =>
                        clipboard(
                            formatAmount(
                                BigNumber(swap().expectedAmount),
                                denomination(),
                            ),
                        )
                    }>
                    {t("copy_amount")}
                </span>
                <span class="btn" onclick={() => clipboard(swap().address)}>
                    {t("copy_address")}
                </span>
            </div>
            <hr />
        </div>
    );
};

export default InvoiceSet;
