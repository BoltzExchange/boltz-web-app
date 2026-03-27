import type { Accessor } from "solid-js";
import { Match, Show, Switch, createEffect, createSignal } from "solid-js";

import { isEvmAsset } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "../utils/swapCreator";
import { getRelevantAssetForSwap, isEvmSwap } from "../utils/swapCreator";
import BlockExplorer, { ExplorerKind } from "./BlockExplorer";

const ChainSwapLink = (props: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
}) => {
    const [hasBeenClaimed, setHasBeenClaimed] = createSignal<boolean>(false);

    createEffect(() => {
        setHasBeenClaimed(props.swap().claimTx !== undefined);
    });

    const asset = () =>
        hasBeenClaimed() ? props.swap().assetReceive : props.swap().assetSend;

    return (
        <BlockExplorer
            asset={asset()}
            txId={props.swap().claimTx}
            explorer={
                props.swap().oft !== undefined && isEvmAsset(asset())
                    ? ExplorerKind.LayerZero
                    : undefined
            }
            address={
                // When it has been claimed, the "txId" is populated
                hasBeenClaimed()
                    ? undefined
                    : (props.swap() as ChainSwap).lockupDetails.lockupAddress
            }
        />
    );
};

const BlockExplorerLink = (props: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
}) => {
    return (
        <Show
            when={props.swap().type !== SwapType.Chain}
            fallback={
                <ChainSwapLink
                    swap={props.swap}
                    swapStatus={props.swapStatus}
                />
            }>
            <Switch>
                <Match when={!isEvmSwap(props.swap())}>
                    {/* Refund transactions are handled in SwapRefunded */}
                    <Show
                        when={
                            getRelevantAssetForSwap(props.swap()) &&
                            props.swapStatus() !== null &&
                            props.swapStatus() !== "invoice.set" &&
                            props.swapStatus() !== "swap.created"
                        }>
                        <BlockExplorer
                            asset={getRelevantAssetForSwap(props.swap())}
                            txId={props.swap().claimTx}
                            explorer={
                                props.swap().oft !== undefined
                                    ? ExplorerKind.LayerZero
                                    : undefined
                            }
                            address={
                                props.swap().type === SwapType.Submarine
                                    ? (props.swap() as SubmarineSwap).address
                                    : (props.swap() as ReverseSwap)
                                          .lockupAddress
                            }
                        />
                    </Show>
                </Match>

                {/* Showing addresses makes no sense for EVM based chains */}
                <Match when={isEvmSwap(props.swap())}>
                    <Show
                        when={props.swap().claimTx !== undefined}
                        fallback={
                            <Show when={props.swap().lockupTx}>
                                <BlockExplorer
                                    asset={getRelevantAssetForSwap(
                                        props.swap(),
                                    )}
                                    txId={props.swap().lockupTx}
                                    typeLabel={"lockup_tx"}
                                />
                            </Show>
                        }>
                        <BlockExplorer
                            asset={getRelevantAssetForSwap(props.swap())}
                            txId={props.swap().claimTx}
                            explorer={
                                props.swap().oft !== undefined
                                    ? ExplorerKind.LayerZero
                                    : undefined
                            }
                            typeLabel={"claim_tx"}
                        />
                    </Show>
                </Match>
            </Switch>
        </Show>
    );
};

export default BlockExplorerLink;
