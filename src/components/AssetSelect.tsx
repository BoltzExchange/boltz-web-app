import log from "loglevel";
import { IoClose } from "solid-icons/io";
import { For } from "solid-js";

import { config } from "../config";
import { LN } from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/pair";

const SelectAsset = () => {
    const assets = Object.keys(config.assets);
    assets.push(LN);

    const { t, fetchPairs, pairs } = useGlobalContext();

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
        if (isSelected(newAsset)) return;

        // clear invoice every time asset changes
        setInvoice("");

        // set new asset and swap assets if the other asset is the same
        if (assetSelected() === Side.Send) {
            if (pair().toAsset === newAsset) {
                setPair(new Pair(pairs(), pair().toAsset, pair().fromAsset));
                // only clear onchain address if assetReceive did change
                setOnchainAddress("");
            }
            setPair(new Pair(pairs(), newAsset, pair().toAsset));
        } else {
            if (pair().fromAsset === newAsset) {
                setPair(new Pair(pairs(), pair().toAsset, pair().fromAsset));
            }
            setPair(new Pair(pairs(), pair().fromAsset, newAsset));
            // always clear onchain address if assetChange did change
            setOnchainAddress("");
        }

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
        <div
            class="frame assets-select"
            onClick={() => setAssetSelect(false)}
            style={assetSelect() ? "display: block;" : "display: none;"}>
            <h2>
                {t("select_asset", {
                    direction:
                        assetSelected() === Side.Send
                            ? t("send")
                            : t("receive"),
                })}
            </h2>
            <span class="close" onClick={() => setAssetSelect(!assetSelect())}>
                <IoClose />
            </span>
            <hr />
            <For each={assets}>
                {(asset) => (
                    <div
                        class={`asset-select asset-${asset}`}
                        data-selected={isSelected(asset)}
                        data-testid={`select-${asset}`}
                        onClick={() => changeAsset(asset)}>
                        <span class="icon" />
                        <span class="asset-text" />
                    </div>
                )}
            </For>
        </div>
    );
};

export default SelectAsset;
