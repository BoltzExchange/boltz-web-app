import type { Accessor } from "solid-js";
import { Match, Show, Switch, createEffect, createSignal } from "solid-js";

import { isEvmAsset } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { bridgeRegistry } from "../utils/bridge";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "../utils/swapCreator";
import {
    getPostBridgeDetail,
    getRelevantAssetForSwap,
    isEvmSwap,
} from "../utils/swapCreator";
import BlockExplorer from "./BlockExplorer";

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
        <Show
            when={!hasBeenClaimed() && isEvmAsset(asset())}
            fallback={
                <BlockExplorer
                    asset={asset()}
                    txId={props.swap().claimTx}
                    explorer={bridgeRegistry.getExplorerKind(
                        getPostBridgeDetail(props.swap().bridge),
                    )}
                    address={
                        // When it has been claimed, the "txId" is populated
                        hasBeenClaimed()
                            ? undefined
                            : (props.swap() as ChainSwap).lockupDetails
                                  .lockupAddress
                    }
                />
            }>
            {/* Showing addresses makes no sense for EVM based chains.
                The lockup tx is a regular EVM tx, not a LayerZero message. */}
            <Show when={props.swap().lockupTx}>
                <BlockExplorer
                    asset={asset()}
                    txId={props.swap().lockupTx}
                    typeLabel={"lockup_tx"}
                />
            </Show>
        </Show>
    );
};

const BlockExplorerLink = (props: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
}) => {
    const bridgeSendPending = () => {
        const s = props.swap();
        return s.bridge?.txHash !== undefined && s.lockupTx === undefined;
    };

    return (
        <Show
            when={!bridgeSendPending()}
            fallback={
                <BlockExplorer
                    asset={props.swap().bridge!.sourceAsset}
                    txId={props.swap().bridge!.txHash}
                    explorer={bridgeRegistry.getExplorerKind(
                        props.swap().bridge,
                    )}
                    typeLabel={"lockup_tx"}
                />
            }>
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
                                explorer={bridgeRegistry.getExplorerKind(
                                    props.swap().bridge,
                                )}
                                address={
                                    props.swap().type === SwapType.Submarine
                                        ? (props.swap() as SubmarineSwap)
                                              .address
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
                                explorer={bridgeRegistry.getExplorerKind(
                                    props.swap().bridge,
                                )}
                                typeLabel={"claim_tx"}
                            />
                        </Show>
                    </Match>
                </Switch>
            </Show>
        </Show>
    );
};

export default BlockExplorerLink;
