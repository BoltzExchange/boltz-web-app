import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { Show } from "solid-js";

import LockupEvm from "../components/LockupEvm";
import PayInvoice from "../components/PayInvoice";
import PayOnchain from "../components/PayOnchain";
import { isEvmAsset } from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import { usePayContext } from "../context/Pay";
import {
    type ChainSwap,
    type ReverseSwap,
    getLockupGasAbstraction,
    getPreOftDetail,
} from "../utils/swapCreator";

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
                when={isEvmAsset(chain.assetSend)}
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
                    gasAbstraction={getLockupGasAbstraction(chain)}
                    amount={chain.lockupDetails.amount}
                    claimAddress={chain.lockupDetails.claimAddress}
                    timeoutBlockHeight={chain.lockupDetails.timeoutBlockHeight}
                    preimageHash={hex.encode(
                        sha256(hex.decode(chain.preimage)),
                    )}
                    asset={chain.assetSend}
                    hops={
                        chain.dex?.position === SwapPosition.Pre
                            ? chain.dex.hops
                            : undefined
                    }
                    oft={getPreOftDetail(chain.oft)}
                />
            </Show>
        </Show>
    );
};

export default SwapCreated;
