import { Accessor, Show, createEffect, createSignal } from "solid-js";

import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
    getRelevantAssetForSwap,
} from "../utils/swapCreator";
import BlockExplorer from "./BlockExplorer";

const BlockExplorerLink = ({
    swap,
    swapStatus,
}: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
}) => {
    // Showing addresses makes no sense for EVM based chains
    if (
        (swap().type !== SwapType.Chain && getRelevantAssetForSwap(swap())) ===
        RBTC
    ) {
        return (
            <Show when={swap().claimTx !== undefined}>
                <BlockExplorer
                    asset={getRelevantAssetForSwap(swap())}
                    txId={swap().claimTx}
                    typeLabel={"claim_tx"}
                />
            </Show>
        );
    }

    if (swap().type !== SwapType.Chain) {
        // Refund transactions are handled in SwapRefunded
        return (
            <Show
                when={
                    getRelevantAssetForSwap(swap()) &&
                    swapStatus() !== null &&
                    swapStatus() !== "invoice.set" &&
                    swapStatus() !== "swap.created"
                }>
                <BlockExplorer
                    asset={getRelevantAssetForSwap(swap())}
                    txId={swap().claimTx}
                    address={
                        swap().type === SwapType.Submarine
                            ? (swap() as SubmarineSwap).address
                            : (swap() as ReverseSwap).lockupAddress
                    }
                />
            </Show>
        );
    }

    const [hasBeenClaimed, setHasBeenClaimed] = createSignal<boolean>(false);

    createEffect(() => {
        setHasBeenClaimed(swap().claimTx !== undefined);
    });

    return (
        <BlockExplorer
            asset={hasBeenClaimed() ? swap().assetReceive : swap().assetSend}
            txId={swap().claimTx}
            address={
                // When it has been claimed, the "txId" is populated
                hasBeenClaimed()
                    ? undefined
                    : (swap() as ChainSwap).lockupDetails.lockupAddress
            }
        />
    );
};

export default BlockExplorerLink;
