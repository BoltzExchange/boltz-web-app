import log from "loglevel";
import { IoClose } from "solid-icons/io";
import { For, Show } from "solid-js";

import { config } from "../config";
import { BTC, LBTC, LN, RBTC, getNetworkBadge } from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";

const getAssetNetwork = (asset: string): string | null => {
    switch (asset) {
        case BTC:
            return "Bitcoin";
        case LN:
            return "Lightning";
        case LBTC:
            return "Liquid";
        case RBTC:
            return "Rootstock";
        default: {
            const assetConfig = config.assets?.[asset];
            if (assetConfig?.network?.chainName) {
                return assetConfig.network.chainName;
            }
            return null;
        }
    }
};

const SelectAsset = () => {
    const assets = [...Object.keys(config.assets), LN].sort();

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

    const changeAsset = (newAsset: string) => {
        if (isSelected(newAsset)) {
            setAssetSelect(false);
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

        setAssetSelect(false);

        void fetchPairs().catch((err) =>
            log.error("Could not fetch pairs", err),
        );
    };

    const isSelected = (asset: string) => {
        return (
            asset ===
            (assetSelected() === Side.Send ? pair().fromAsset : pair().toAsset)
        );
    };

    return (
        <Show when={assetSelect()}>
            <div
                class="asset-select-overlay"
                onClick={() => setAssetSelect(false)}>
                <div
                    class="asset-select-modal"
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
                        <span
                            class="asset-select-close"
                            onClick={() => setAssetSelect(false)}>
                            <IoClose />
                        </span>
                    </div>
                    <div class="asset-select-list">
                        <For each={assets}>
                            {(asset) => {
                                const network = getAssetNetwork(asset);
                                return (
                                    <div
                                        class={`asset-select-item asset-${asset}`}
                                        data-network={getNetworkBadge(asset)}
                                        data-selected={isSelected(asset)}
                                        data-testid={`select-${asset}`}
                                        onClick={() => changeAsset(asset)}>
                                        <span class="icon" />
                                        <div class="asset-select-info">
                                            <span class="asset-select-name">
                                                {asset}
                                            </span>
                                            <Show when={network}>
                                                <span class="asset-select-network">
                                                    {network}
                                                </span>
                                            </Show>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>
            </div>
        </Show>
    );
};

export default SelectAsset;
