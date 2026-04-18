import log from "loglevel";
import { IoArrowBack, IoClose } from "solid-icons/io";
import {
    For,
    Show,
    createEffect,
    createMemo,
    createSignal,
    on,
} from "solid-js";

import { config } from "../config";
import {
    USDT0,
    getAssetNetwork,
    getNetworkBadge,
    isUsdt0Variant,
} from "../consts/Assets";
import { AssetSelection, Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import {
    fuzzySort,
    handleListKeyDown,
    scrollToFocused,
} from "../utils/assetSearch";
import { shouldPreserveOnchainAddress } from "../utils/preserveDestination";
import { canSelectAsset, isAssetDisabled } from "../utils/selectableAsset";

const isTouchDevice = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

const NetworkSelect = () => {
    const { t, fetchPairs, pairs, regularPairs } = useGlobalContext();

    const {
        pair,
        setPair,
        assetSelected,
        assetSelection,
        setAssetSelection,
        setInvoice,
        setOnchainAddress,
    } = useCreateContext();

    const [search, setSearch] = createSignal("");
    const [focusedIndex, setFocusedIndex] = createSignal(0);
    let listRef: HTMLDivElement;

    const usdt0Networks = createMemo(() =>
        [USDT0, ...Object.keys(config.assets).filter(isUsdt0Variant)]
            .filter((asset) => canSelectAsset(assetSelected(), asset))
            .sort((a, b) =>
                (getAssetNetwork(a) ?? "").localeCompare(
                    getAssetNetwork(b) ?? "",
                ),
            ),
    );

    const filtered = () =>
        fuzzySort(
            usdt0Networks(),
            search(),
            (asset) => getAssetNetwork(asset) ?? "",
        );

    createEffect(
        on(
            () => assetSelection(),
            (selection) => {
                if (selection !== AssetSelection.AssetNetwork) {
                    return;
                }

                const idx = filtered().findIndex(isSelected);
                setFocusedIndex(idx >= 0 ? idx : 0);
            },
        ),
    );

    createEffect(on(search, () => setFocusedIndex(0)));

    createEffect(() => scrollToFocused(listRef, focusedIndex()));

    const close = () => {
        setAssetSelection(null);
        setSearch("");
    };

    const goBack = () => {
        setAssetSelection(AssetSelection.Asset);
        setSearch("");
    };

    const isSelected = (asset: string) =>
        asset ===
        (assetSelected() === Side.Send ? pair().fromAsset : pair().toAsset);

    const selectNetwork = (newAsset: string) => {
        if (isAssetDisabled(newAsset)) {
            return;
        }
        if (isSelected(newAsset)) {
            close();
            return;
        }

        setInvoice("");

        let nextPair: Pair;

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

    const selectFocused = () => {
        const items = filtered();
        if (items[focusedIndex()]) {
            selectNetwork(items[focusedIndex()]);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "j" || e.key === "k") {
            return;
        }
        handleListKeyDown(
            e,
            filtered().length,
            setFocusedIndex,
            selectFocused,
            close,
        );
    };

    return (
        <Show when={assetSelection() === AssetSelection.AssetNetwork}>
            <div class="asset-select-overlay" onClick={close}>
                <div
                    class="asset-select-modal"
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}>
                    <div class="asset-select-header">
                        <button
                            type="button"
                            class="asset-select-back"
                            data-testid="network-back"
                            onClick={goBack}>
                            <IoArrowBack />
                        </button>
                        <h3>{t("select_network")}</h3>
                        <button
                            type="button"
                            class="asset-select-close"
                            data-testid="network-close"
                            onClick={close}>
                            <IoClose />
                        </button>
                    </div>
                    <div class="asset-select-search">
                        <input
                            ref={(el) => {
                                if (!isTouchDevice())
                                    setTimeout(() => el.focus());
                            }}
                            type="text"
                            placeholder={t("search")}
                            value={search()}
                            onInput={(e) => setSearch(e.currentTarget.value)}
                        />
                        <Show when={search()}>
                            <button
                                type="button"
                                class="asset-select-search-clear"
                                data-testid="search-clear"
                                onClick={() => setSearch("")}>
                                <IoClose />
                            </button>
                        </Show>
                    </div>
                    <div class="asset-select-list" ref={listRef}>
                        <For each={filtered()}>
                            {(asset, i) => {
                                const network = getAssetNetwork(asset);
                                return (
                                    <button
                                        type="button"
                                        class="asset-select-item network-icon"
                                        data-network={getNetworkBadge(asset)}
                                        data-selected={isSelected(asset)}
                                        data-focused={focusedIndex() === i()}
                                        data-disabled={isAssetDisabled(asset)}
                                        disabled={isAssetDisabled(asset)}
                                        data-testid={`select-${asset}`}
                                        onMouseEnter={() =>
                                            setFocusedIndex(i())
                                        }
                                        onClick={() => selectNetwork(asset)}>
                                        <span class="icon" />
                                        <div class="asset-select-info">
                                            <span class="asset-select-name">
                                                {network}
                                            </span>
                                        </div>
                                    </button>
                                );
                            }}
                        </For>
                    </div>
                </div>
            </div>
        </Show>
    );
};

export default NetworkSelect;
