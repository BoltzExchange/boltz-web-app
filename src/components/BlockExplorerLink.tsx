import { Accessor, Show, createEffect, createSignal } from "solid-js";

import { SwapType } from "../consts/Enums";
import {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
    getRelevantAssetForSwap,
} from "../utils/swapCreator";
import BlockExplorer from "./BlockExplorer";

enum TransactionType {
    Lockup = "lockupTx",
    Claim = "claimTx",
}

const BlockExplorerLink = ({
    swap,
    swapStatus,
    contractTransaction,
    contractTransactionType,
}: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
    contractTransaction: Accessor<string>;
    contractTransactionType: Accessor<TransactionType>;
}) => {
    // Refund transactions are handled in SwapRefunded

    if (swap().type !== SwapType.Chain) {
        return (
            <>
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
                <Show
                    when={
                        getRelevantAssetForSwap(swap()) &&
                        contractTransaction() !== undefined
                    }>
                    <BlockExplorer
                        asset={getRelevantAssetForSwap(swap())}
                        txId={contractTransaction()}
                        typeLabel={contractTransactionType()}
                    />
                </Show>
            </>
        );
    }

    // TODO: RSK

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
export { TransactionType };
