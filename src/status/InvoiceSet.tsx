import { SwapPosition } from "boltz-swaps/types";
import { Show, createMemo } from "solid-js";
import { getAddress } from "viem";

import LockupEvm from "../components/LockupEvm";
import PayOnchain from "../components/PayOnchain";
import { isEvmAsset } from "../consts/Assets";
import { usePayContext } from "../context/Pay";
import { decodeInvoice } from "../utils/invoice";
import {
    type SubmarineSwap,
    getLockupGasAbstraction,
    getPreBridgeDetail,
} from "../utils/swapCreator";

const InvoiceSet = () => {
    const { swap } = usePayContext();
    const submarine = swap() as SubmarineSwap;

    const preimageHash = createMemo(
        () => decodeInvoice(submarine.invoice).preimageHash,
    );

    return (
        <Show
            when={isEvmAsset(submarine.assetSend)}
            fallback={
                <PayOnchain
                    type={submarine.type}
                    assetSend={submarine.assetSend}
                    assetReceive={submarine.assetReceive}
                    expectedAmount={submarine.expectedAmount}
                    address={submarine.address}
                    bip21={submarine.bip21}
                />
            }>
            <LockupEvm
                swapId={submarine.id}
                gasAbstraction={getLockupGasAbstraction(submarine)}
                amount={submarine.expectedAmount}
                claimAddress={getAddress(submarine.claimAddress!)}
                preimageHash={preimageHash()}
                timeoutBlockHeight={submarine.timeoutBlockHeight}
                asset={submarine.assetSend}
                hops={
                    submarine.dex?.position === SwapPosition.Pre
                        ? submarine.dex.hops
                        : undefined
                }
                hopInputAmount={
                    submarine.dex?.position === SwapPosition.Pre
                        ? submarine.dex.sourceAmount
                        : undefined
                }
                bridge={getPreBridgeDetail(submarine.bridge)}
            />
        </Show>
    );
};

export default InvoiceSet;
