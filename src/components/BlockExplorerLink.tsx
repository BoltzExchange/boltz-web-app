import { bridgeRegistry } from "boltz-swaps/bridge";
import { ExplorerKind, SwapType } from "boltz-swaps/types";
import { type Accessor, Match, Show, Switch, createMemo } from "solid-js";

import { isEvmAsset } from "../consts/Assets";
import {
    SideSwapStatus,
    type SomeSwap,
    getFinalAssetReceive,
    getPostBridgeDetail,
    getRelevantAssetForSwap,
    getSwapAddress,
    isEvmSwap,
} from "../utils/swapCreator";
import BlockExplorer, { BlockExplorerTargetKind } from "./BlockExplorer";

const claimTxLabel = (explorer: ExplorerKind | undefined) =>
    explorer === ExplorerKind.LayerZero || explorer === ExplorerKind.Cctp
        ? "bridge_status"
        : undefined;

const getSideSwapClaimTx = (swap: SomeSwap): string | undefined =>
    swap.sideswap?.status === SideSwapStatus.Confirmed
        ? swap.sideswap.txid
        : undefined;

const hasPendingSideSwapAfterBoltzClaim = (swap: SomeSwap): boolean =>
    swap.sideswap !== undefined &&
    getSideSwapClaimTx(swap) === undefined &&
    swap.claimTx !== undefined;

const ChainSwapLink = (props: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
}) => {
    const txToShow = () =>
        getSideSwapClaimTx(props.swap()) ?? props.swap().claimTx;
    const hasBeenClaimed = () => txToShow() !== undefined;

    const asset = () =>
        getSideSwapClaimTx(props.swap()) !== undefined
            ? getFinalAssetReceive(props.swap())
            : hasBeenClaimed()
              ? props.swap().assetReceive
              : props.swap().assetSend;

    const explorer = createMemo(() =>
        bridgeRegistry.getExplorerKind(
            getPostBridgeDetail(props.swap().bridge),
        ),
    );

    return (
        <Show
            when={!hasBeenClaimed() && isEvmAsset(asset())}
            fallback={
                <BlockExplorer
                    asset={asset()}
                    kind={
                        hasBeenClaimed()
                            ? BlockExplorerTargetKind.Tx
                            : BlockExplorerTargetKind.Address
                    }
                    id={
                        hasBeenClaimed()
                            ? txToShow()!
                            : getSwapAddress(props.swap())
                    }
                    explorer={explorer()}
                    typeLabel={
                        hasBeenClaimed() ? claimTxLabel(explorer()) : undefined
                    }
                />
            }>
            {/* Showing addresses makes no sense for EVM based chains.
                The lockup tx is a regular EVM tx, not a LayerZero message. */}
            <Show when={props.swap().lockupTx}>
                <BlockExplorer
                    asset={asset()}
                    kind={BlockExplorerTargetKind.Tx}
                    id={props.swap().lockupTx!}
                    typeLabel={"lockup_tx"}
                />
            </Show>
        </Show>
    );
};

const BlockExplorerLinkInner = (props: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
}) => {
    const sideSwapClaimTx = () => getSideSwapClaimTx(props.swap());
    const txToShow = () => sideSwapClaimTx() ?? props.swap().claimTx;
    const assetToShow = () =>
        sideSwapClaimTx() !== undefined
            ? getFinalAssetReceive(props.swap())
            : getRelevantAssetForSwap(props.swap());

    const bridgeSendPending = () => {
        const s = props.swap();
        return (
            s.bridge?.txHash !== undefined &&
            s.lockupTx === undefined &&
            s.commitmentLockupTxHash === undefined
        );
    };

    return (
        <Show
            when={!bridgeSendPending()}
            fallback={
                <BlockExplorer
                    asset={props.swap().bridge!.sourceAsset}
                    kind={BlockExplorerTargetKind.Tx}
                    id={props.swap().bridge!.txHash!}
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
                                asset={assetToShow()}
                                kind={
                                    txToShow() !== undefined
                                        ? BlockExplorerTargetKind.Tx
                                        : BlockExplorerTargetKind.Address
                                }
                                id={
                                    txToShow() !== undefined
                                        ? txToShow()!
                                        : getSwapAddress(props.swap())
                                }
                                explorer={bridgeRegistry.getExplorerKind(
                                    props.swap().bridge,
                                )}
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
                                        kind={BlockExplorerTargetKind.Tx}
                                        id={props.swap().lockupTx!}
                                        typeLabel={"lockup_tx"}
                                    />
                                </Show>
                            }>
                            <BlockExplorer
                                asset={getRelevantAssetForSwap(props.swap())}
                                kind={BlockExplorerTargetKind.Tx}
                                id={props.swap().claimTx!}
                                explorer={bridgeRegistry.getExplorerKind(
                                    props.swap().bridge,
                                )}
                                typeLabel={
                                    claimTxLabel(
                                        bridgeRegistry.getExplorerKind(
                                            props.swap().bridge,
                                        ),
                                    ) ?? "claim_tx"
                                }
                            />
                        </Show>
                    </Match>
                </Switch>
            </Show>
        </Show>
    );
};

const BlockExplorerLink = (props: {
    swap: Accessor<SomeSwap | null>;
    swapStatus: Accessor<string>;
}) => {
    const visibleSwap = createMemo(() => {
        const swap = props.swap();
        if (swap === null || hasPendingSideSwapAfterBoltzClaim(swap)) {
            return undefined;
        }

        return swap;
    });

    return (
        <Show when={visibleSwap()}>
            {(swap) => (
                <BlockExplorerLinkInner
                    swap={swap}
                    swapStatus={props.swapStatus}
                />
            )}
        </Show>
    );
};

export default BlockExplorerLink;
