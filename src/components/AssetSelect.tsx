import log from "loglevel";
import { IoClose } from "solid-icons/io";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

import {
    getAssetDisplaySymbol,
    getAssetNetwork,
    getAssetPickerCanonical,
    getNetworkBadge,
    hasAssetPickerNetworkVariants,
    isAssetPickerNetworkVariant,
    isBridgeVariant,
    assets as orderedAssets,
} from "../consts/Assets";
import { AssetSelection, Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import { findEnabledIndex, handleListKeyDown } from "../utils/assetSearch";
import { shouldPreserveOnchainAddress } from "../utils/preserveDestination";
import { canSelectAsset, isAssetDisabled } from "../utils/selectableAsset";

// True if this top-level entry has >= 1 network-specific variant registered.
const hasNetworkVariants = hasAssetPickerNetworkVariants;

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
        destinationLocked,
    } = useCreateContext();

    const [focusedIndex, setFocusedIndex] = createSignal(0);

    const assets = createMemo(() =>
        orderedAssets.filter(
            (asset) =>
                !isBridgeVariant(asset) &&
                !isAssetPickerNetworkVariant(asset) &&
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

    const selectFocused = () => handleAssetClick(assets()[focusedIndex()]);
    const close = () => {
        setAssetSelection(null);
    };

    const focusHorizontal = (direction: 1 | -1) => {
        const list = assets();
        const columnSize = Math.ceil(list.length / 2);

        setFocusedIndex((i) => {
            const columnStart = direction === 1 ? columnSize : 0;
            const columnEnd = direction === 1 ? list.length : columnSize;
            const target = i + direction * columnSize;

            if (target < columnStart || target >= columnEnd) {
                return i;
            }

            const maxOffset = Math.max(
                target - columnStart,
                columnEnd - 1 - target,
            );
            for (let offset = 0; offset <= maxOffset; offset++) {
                const forward = target + offset;
                if (forward < columnEnd && !isIndexDisabled(forward)) {
                    return forward;
                }
                if (offset === 0) continue;
                const backward = target - offset;
                if (backward >= columnStart && !isIndexDisabled(backward)) {
                    return backward;
                }
            }
            return i;
        });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
            case "ArrowRight":
            case "l":
                e.preventDefault();
                focusHorizontal(1);
                return;
            case "ArrowLeft":
            case "h":
                e.preventDefault();
                focusHorizontal(-1);
                return;
        }

        handleListKeyDown(
            e,
            assets().length,
            setFocusedIndex,
            selectFocused,
            close,
            isIndexDisabled,
        );
    };

    const changeAsset = (newAsset: string) => {
        if (isSelected(newAsset)) {
            close();
            return;
        }

        // clear invoice every time asset changes (unless destination is locked)
        if (!destinationLocked()) {
            setInvoice("");
        }

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
        if (hasNetworkVariants(asset)) {
            setNetworkSelectCanonical(asset);
            setAssetSelection(AssetSelection.AssetNetwork);
            return;
        }
        changeAsset(asset);
    };

    const isSelected = (asset: string) => {
        const current =
            assetSelected() === Side.Send ? pair().fromAsset : pair().toAsset;
        if (hasNetworkVariants(asset)) {
            return getAssetPickerCanonical(current) === asset;
        }
        return asset === current;
    };

    return (
        <Show
            when={assetSelection() === AssetSelection.Asset && !bitcoinOnly()}>
            <div class="asset-select-overlay" onClick={close}>
                <div
                    class="asset-select-modal asset-select-modal--assets"
                    ref={(el) => setTimeout(() => el.focus())}
                    tabIndex={-1}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}>
                    <div class="asset-select-header">
                        <h3>
                            {t(
                                assetSelected() === Side.Send
                                    ? "select_asset_send"
                                    : "select_asset_receive",
                            )}
                        </h3>
                        <button
                            type="button"
                            class="asset-select-close"
                            data-testid="asset-select-close"
                            onClick={close}>
                            <IoClose />
                        </button>
                    </div>
                    <div class="asset-select-list asset-select-list--two-column">
                        <For each={assets()}>
                            {(asset, i) => (
                                <button
                                    type="button"
                                    class={`asset-select-item asset-${getAssetDisplaySymbol(asset)}`}
                                    data-network={
                                        hasNetworkVariants(asset)
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
                                            {hasNetworkVariants(asset)
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
