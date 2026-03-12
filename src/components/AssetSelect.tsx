import log from "loglevel";
import { IoArrowBack, IoClose } from "solid-icons/io";
import { For, Show, createSignal } from "solid-js";

import { config } from "../config";
import {
    BTC,
    LBTC,
    LN,
    USDT0,
    getAssetDisplaySymbol,
    getNetworkBadge,
    isUsdt0Variant,
} from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import { fuzzySort } from "../utils/search";

const isTouchDevice = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

const getAssetNetwork = (asset: string): string | null => {
    switch (asset) {
        case BTC:
            return "Bitcoin";
        case LN:
            return "Lightning";
        case LBTC:
            return "Liquid";
        default: {
            const assetConfig = config.assets?.[asset];
            if (assetConfig?.network?.chainName) {
                return assetConfig.network.chainName;
            }
            return null;
        }
    }
};

const usdt0VariantAssets = Object.keys(config.assets).filter((asset) =>
    isUsdt0Variant(asset),
);

const usdt0Networks = [USDT0, ...usdt0VariantAssets].sort((a, b) =>
    (getAssetNetwork(a) ?? "").localeCompare(getAssetNetwork(b) ?? ""),
);

const SelectAsset = () => {
    const assets = [...Object.keys(config.assets), LN]
        .filter((asset) => !usdt0VariantAssets.includes(asset))
        .sort();

    const [showNetworkSelect, setShowNetworkSelect] = createSignal(false);
    const [networkSearch, setNetworkSearch] = createSignal("");

    const filteredNetworks = () =>
        fuzzySort(
            usdt0Networks,
            networkSearch(),
            (asset) => getAssetNetwork(asset) ?? "",
        );

    const { t, fetchPairs, pairs, regularPairs } = useGlobalContext();

    const {
        pair,
        setPair,
        assetSelect,
        assetSelected,
        setAssetSelect,
        setInvoice,
        setOnchainAddress,
    } = useCreateContext();

    const close = () => {
        setAssetSelect(false);
        setShowNetworkSelect(false);
        setNetworkSearch("");
    };

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
        if (asset === USDT0) {
            setShowNetworkSelect(true);
            return;
        }
        changeAsset(asset);
    };

    const isSelected = (asset: string) =>
        asset ===
        (assetSelected() === Side.Send ? pair().fromAsset : pair().toAsset);

    return (
        <Show when={assetSelect()}>
            <div class="asset-select-overlay" onClick={close}>
                <div
                    class="asset-select-modal"
                    onClick={(e) => e.stopPropagation()}>
                    <Show
                        when={!showNetworkSelect()}
                        fallback={
                            <>
                                <div class="asset-select-header">
                                    <button
                                        type="button"
                                        class="asset-select-back"
                                        data-testid="network-back"
                                        onClick={() => {
                                            setShowNetworkSelect(false);
                                            setNetworkSearch("");
                                        }}>
                                        <IoArrowBack />
                                    </button>
                                    <h3>{t("select_network")}</h3>
                                    <button
                                        type="button"
                                        class="asset-select-close"
                                        data-testid="asset-select-close"
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
                                        value={networkSearch()}
                                        onInput={(e) =>
                                            setNetworkSearch(
                                                e.currentTarget.value,
                                            )
                                        }
                                    />
                                    <Show when={networkSearch()}>
                                        <button
                                            type="button"
                                            class="asset-select-search-clear"
                                            data-testid="search-clear"
                                            onClick={() =>
                                                setNetworkSearch("")
                                            }>
                                            <IoClose />
                                        </button>
                                    </Show>
                                </div>
                                <div class="asset-select-list">
                                    <For each={filteredNetworks()}>
                                        {(asset) => {
                                            const network =
                                                getAssetNetwork(asset);
                                            return (
                                                <button
                                                    type="button"
                                                    class="asset-select-item network-icon"
                                                    data-network={getNetworkBadge(
                                                        asset,
                                                    )}
                                                    data-selected={isSelected(
                                                        asset,
                                                    )}
                                                    data-testid={`select-${asset}`}
                                                    onClick={() =>
                                                        changeAsset(asset)
                                                    }>
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
                            </>
                        }>
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
                        <div class="asset-select-list">
                            <For each={assets}>
                                {(asset) => (
                                    <button
                                        type="button"
                                        class={`asset-select-item asset-${getAssetDisplaySymbol(asset)}`}
                                        data-network={
                                            asset !== USDT0
                                                ? getNetworkBadge(asset)
                                                : null
                                        }
                                        data-selected={isSelected(asset)}
                                        data-testid={`select-${asset}`}
                                        onClick={() => handleAssetClick(asset)}>
                                        <span class="icon" />
                                        <div class="asset-select-info">
                                            <span class="asset-select-name">
                                                {getAssetDisplaySymbol(asset)}
                                            </span>
                                            <span class="asset-select-network">
                                                {asset === USDT0
                                                    ? t("select_network")
                                                    : getAssetNetwork(asset)}
                                            </span>
                                        </div>
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
            </div>
        </Show>
    );
};

export default SelectAsset;
