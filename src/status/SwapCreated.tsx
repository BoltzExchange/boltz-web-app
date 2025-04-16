import { crypto } from "bitcoinjs-lib";
import { Show } from "solid-js";

import LockupEvm from "../components/LockupEvm";
import PayInvoice from "../components/PayInvoice";
import PayOnchain from "../components/PayOnchain";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { usePayContext } from "../context/Pay";
import type { ChainSwap, ReverseSwap } from "../utils/swapCreator";

const SwapCreated = () => {
    const { swap } = usePayContext();

    const chain = swap() as ChainSwap;
    const reverse = swap() as ReverseSwap;

    return (
        <Show
            when={swap().type === SwapType.Chain}
            fallback={
                <PayInvoice
                    sendAmount={reverse.sendAmount}
                    invoice={reverse.invoice}
                />
            }>
            <Show
                when={chain.assetSend === RBTC}
                fallback={
                    <PayOnchain
                        type={chain.type}
                        assetSend={chain.assetSend}
                        assetReceive={chain.assetReceive}
                        expectedAmount={chain.lockupDetails.amount}
                        address={chain.lockupDetails.lockupAddress}
                        bip21={chain.lockupDetails.bip21}
                    />
                }>
                <LockupEvm
                    swapId={chain.id}
                    signerAddress={chain.signer}
                    amount={chain.lockupDetails.amount}
                    claimAddress={chain.lockupDetails.claimAddress}
                    timeoutBlockHeight={chain.lockupDetails.timeoutBlockHeight}
                    preimageHash={crypto
                        .sha256(Buffer.from(chain.preimage, "hex"))
                        .toString("hex")}
                />
            </Show>
        </Show>
    );
};

export default SwapCreated;
