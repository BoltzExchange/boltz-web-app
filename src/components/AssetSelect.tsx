import log from "loglevel";
import { IoClose } from "solid-icons/io";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

import { config } from "../config";
import {
    LN,
    USDT0,
    getAssetDisplaySymbol,
    getAssetNetwork,
    getNetworkBadge,
    isUsdt0Asset,
    isUsdt0Variant,
} from "../consts/Assets";
import { AssetSelection, Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import { handleListKeyDown, scrollToFocused } from "../utils/assetSearch";
import { canSelectAsset } from "../utils/selectableAsset";

const hasUsdt0 = USDT0 in config.assets;

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
    } = useCreateContext();

    const [focusedIndex, setFocusedIndex] = createSignal(0);
    let listRef: HTMLDivElement;

    const assets = createMemo(() =>
        [...Object.keys(config.assets), LN]
            .filter(
                (asset) =>
                    !isUsdt0Variant(asset) &&
                    canSelectAsset(assetSelected(), asset),
            )
            .sort(),
    );

    createEffect(() => {
        if (assetSelection() === AssetSelection.Asset) {
            const idx = assets().findIndex(isSelected);
            setFocusedIndex(idx >= 0 ? idx : 0);
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
        );

    const changeAsset = (newAsset: string) => {
        if (isSelected(newAsset)) {
            close();
            return;
        }

        // clear invoice every time asset changes
        setInvoice("");

        // set new asset and swap assets if the other asset is the same
        if (assetSelected() === Side.Send) {
            let toAsset = pair().toAsset;
            if (toAsset === newAsset) {
                toAsset = pair().fromAsset;
                // only clear onchain address if assetReceive did change
                setOnchainAddress("");
            }
            setPair(new Pair(pairs(), newAsset, toAsset, regularPairs()));
        } else {
            let fromAsset = pair().fromAsset;
            if (fromAsset === newAsset) {
                fromAsset = pair().toAsset;
            }
            setPair(new Pair(pairs(), fromAsset, newAsset, regularPairs()));
            // always clear onchain address if assetReceive changes
            setOnchainAddress("");
        }

        close();

        void fetchPairs().catch((err) =>
            log.error("Could not fetch pairs", err),
        );
    };

    const handleAssetClick = (asset: string) => {
        if (asset === USDT0 && hasUsdt0) {
            setAssetSelection(AssetSelection.AssetNetwork);
            return;
        }
        changeAsset(asset);
    };

    const isSelected = (asset: string) => {
        const current =
            assetSelected() === Side.Send ? pair().fromAsset : pair().toAsset;
        if (asset === USDT0 && hasUsdt0) return isUsdt0Asset(current);
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
                                        asset !== USDT0 || !hasUsdt0
                                            ? getNetworkBadge(asset)
                                            : null
                                    }
                                    data-selected={isSelected(asset)}
                                    data-focused={focusedIndex() === i()}
                                    data-testid={`select-${asset}`}
                                    onMouseEnter={() => setFocusedIndex(i())}
                                    onClick={() => handleAssetClick(asset)}>
                                    <span class="icon" />
                                    <div class="asset-select-info">
                                        <span class="asset-select-name">
                                            {getAssetDisplaySymbol(asset)}
                                        </span>
                                        <span class="asset-select-network">
                                            {asset === USDT0 && hasUsdt0
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
