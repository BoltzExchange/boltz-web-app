import { Accessor, createSignal } from "solid-js";

import { RBTC } from "../consts";
import { useWeb3Signer } from "../context/Web3";
import t from "../i18n";
import {  updateSwaps } from "../utils/helper";
import { decodeInvoice } from "../utils/invoice";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import ContractTransaction from "./ContractTransaction";
import RefundCreate from "./RefundCreate";

const Refund = ({ swap }: { swap: Accessor<Record<string, any>> }) => {
    if (swap().asset === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <ContractTransaction
                onClick={async () => {
                    const contract = await getEtherSwap();
                    const tx = await contract.refund(
                        prefix0x(decodeInvoice(swap().invoice).preimageHash),
                        satoshiToWei(swap().expectedAmount),
                        swap().claimAddress,
                        swap().timeoutBlockHeight,
                    );
                    updateSwaps((current: any) => (current.refundTx = tx.hash));
                    await tx.wait(1);
                }}
                buttonText={t("refund")}
            />
        );
    }

    // a swap not from refundjson is always valid
    const [valid, _] = createSignal<boolean>(true);

    return (
        <>
            <h2>{t("refund")}</h2>
            <RefundCreate swap={swap} refundValid={valid} />
        </>
    );
};

export default Refund;
