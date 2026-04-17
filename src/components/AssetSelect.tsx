import log from "loglevel";
import { IoClose } from "solid-icons/io";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

import {
    getAssetBridge,
    getAssetDisplaySymbol,
    getAssetNetwork,
    getBridgeVariants,
    getNetworkBadge,
    isBridgeCanonicalAsset,
    isBridgeVariant,
    assets as orderedAssets,
} from "../consts/Assets";
import { AssetSelection, Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import {
    findEnabledIndex,
    handleListKeyDown,
    scrollToFocused,
} from "../utils/assetSearch";
import { shouldPreserveOnchainAddress } from "../utils/preserveDestination";
import { canSelectAsset, isAssetDisabled } from "../utils/selectableAsset";

// True if this canonical hub has >= 1 chain-specific variant registered.
const hasBridgeVariants = (asset: string) =>
    isBridgeCanonicalAsset(asset) && getBridgeVariants(asset).length > 0;

const SelectAsset = () => {
    const { t, fetchPairs, pairs, regularPairs, bitcoinOnly } =
        useGlobalContext();

    const {
        pair,
        setPair,
        assetSelection,
        setAssetSelection,
        assetSelected,
        setInvoice,
        setOnchainAddress,
        setNetworkSelectCanonical,
    } = useCreateContext();

    const [focusedIndex, setFocusedIndex] = createSignal(0);
    let listRef: HTMLDivElement;

    const assets = createMemo(() =>
        orderedAssets.filter(
            (asset) =>
                !isBridgeVariant(asset) &&
                canSelectAsset(assetSelected(), asset),
        ),
    );

    const isIndexDisabled = (i: number) => isAssetDisabled(assets()[i]);

    createEffect(() => {
        if (assetSelection() === AssetSelection.Asset) {
            const list = assets();
            const idx = list.findIndex(isSelected);
            setFocusedIndex(
                findEnabledIndex(
                    idx >= 0 ? idx : 0,
                    1,
                    list.length,
                    isIndexDisabled,
                ),
            );
        }
    });

    createEffect(() => scrollToFocused(listRef, focusedIndex()));

    const selectFocused = () => handleAssetClick(assets()[focusedIndex()]);
    const close = () => setAssetSelection(null);

    const handleKeyDown = (e: KeyboardEvent) =>
        handleListKeyDown(
            e,
            assets().length,
            setFocusedIndex,
            selectFocused,
            close,
            isIndexDisabled,
        );

    const changeAsset = (newAsset: string) => {
        if (isSelected(newAsset)) {
            close();
            return;
        }

        // clear invoice every time asset changes
        setInvoice("");

        let nextPair: Pair;

        // set new asset and swap assets if the other asset is the same
        if (assetSelected() === Side.Send) {
            let toAsset = pair().toAsset;
            if (toAsset === newAsset) {
                toAsset = pair().fromAsset;
            }
            nextPair = new Pair(pairs(), newAsset, toAsset, regularPairs());
        } else {
            let fromAsset = pair().fromAsset;
            if (fromAsset === newAsset) {
                fromAsset = pair().toAsset;
            }
            nextPair = new Pair(pairs(), fromAsset, newAsset, regularPairs());
        }

        if (!shouldPreserveOnchainAddress(pair(), nextPair)) {
            setOnchainAddress("");
        }
        setPair(nextPair);

        close();

        void fetchPairs().catch((err) =>
            log.error("Could not fetch pairs", err),
        );
    };

    const handleAssetClick = (asset: string) => {
        if (isAssetDisabled(asset)) {
            return;
        }
        if (hasBridgeVariants(asset)) {
            setNetworkSelectCanonical(asset);
            setAssetSelection(AssetSelection.AssetNetwork);
            return;
        }
        changeAsset(asset);
    };

    const isSelected = (asset: string) => {
        const current =
            assetSelected() === Side.Send ? pair().fromAsset : pair().toAsset;
        if (hasBridgeVariants(asset)) {
            return getAssetBridge(current)?.canonicalAsset === asset;
        }
        return asset === current;
    };

    return (
        <Show
            when={assetSelection() === AssetSelection.Asset && !bitcoinOnly()}>
            <div class="asset-select-overlay" onClick={close}>
                <div
                    class="asset-select-modal"
                    ref={(el) => setTimeout(() => el.focus())}
                    tabIndex={-1}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}>
                    <div class="asset-select-header">
                        <h3>
                            {t("select_asset", {
                                direction:
                                    assetSelected() === Side.Send
                                        ? t("send")
                                        : t("receive"),
                            })}
                        </h3>
                        <button
                            type="button"
                            class="asset-select-close"
                            data-testid="asset-select-close"
                            onClick={close}>
                            <IoClose />
                        </button>
                    </div>
                    <div class="asset-select-list" ref={listRef}>
                        <For each={assets()}>
                            {(asset, i) => (
                                <button
                                    type="button"
                                    class={`asset-select-item asset-${getAssetDisplaySymbol(asset)}`}
                                    data-network={
                                        hasBridgeVariants(asset)
                                            ? null
                                            : getNetworkBadge(asset)
                                    }
                                    data-selected={isSelected(asset)}
                                    data-focused={focusedIndex() === i()}
                                    data-disabled={isAssetDisabled(asset)}
                                    disabled={isAssetDisabled(asset)}
                                    data-testid={`select-${asset}`}
                                    onMouseEnter={() => setFocusedIndex(i())}
                                    onClick={() => handleAssetClick(asset)}>
                                    <span class="icon" />
                                    <div class="asset-select-info">
                                        <span class="asset-select-name">
                                            {getAssetDisplaySymbol(asset)}
                                        </span>
                                        <span class="asset-select-network">
                                            {hasBridgeVariants(asset)
                                                ? t("select_network")
                                                : getAssetNetwork(asset)}
                                        </span>
                                    </div>
                                </button>
                            )}
                        </For>
                    </div>
                </div>
            </div>
        </Show>
    );
};

export default SelectAsset;
