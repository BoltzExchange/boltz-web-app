import { Accessor, createSignal } from "solid-js";

import { RBTC } from "../consts";
import { useWeb3Signer } from "../context/Web3";
import { refund, refundAddressChange, updateSwaps } from "../helper";
import t from "../i18n";
import { prefix0x, satoshiToWei } from "../utils/ethereum";
import { decodeInvoice } from "../utils/validation";
import EthereumTransaction from "./EthereumTransaction";

const Refund = ({ swap }: { swap: Accessor<Record<string, any>> }) => {
    if (swap().asset === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <EthereumTransaction
                onClick={async () => {
                    const contract = await getEtherSwap();
                    const tx = await contract.refund(
                        prefix0x(decodeInvoice(swap().invoice).preimageHash),
                        satoshiToWei(swap().expectedAmount),
                        swap().claimAddress,
                        swap().timeoutBlockHeight,
                    );
                    updateSwaps((current) => (current.refundTx = tx.hash));
                    await tx.wait(1);
                }}
                buttonText={t("refund")}
            />
        );
    }

    const [valid, setValid] = createSignal<boolean>(false);

    return (
        <>
            <h2>{t("refund")}</h2>
            <input
                id="refundAddress"
                onInput={(e) => setValid(refundAddressChange(e, swap().asset))}
                type="text"
                name="refundAddress"
                placeholder={t("refund_address_placeholder")}
            />
            <button
                class="btn"
                disabled={valid()}
                onclick={() => refund(swap())}>
                {t("refund")}
            </button>
        </>
    );
};

export default Refund;
