import type { Accessor } from "solid-js";

import { getAssetDisplaySymbol, getNetworkBadge } from "../consts/Assets";
import { AssetSelection, type Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import "../style/asset.scss";

const Asset = (props: { side: Side; signal: Accessor<string> }) => {
    const { bitcoinOnly, notify, t } = useGlobalContext();

    const openSelect = () => {
        if (bitcoinOnly()) {
            notify("error", t("bitcoin_only_warning"));
            return;
        }
        setAssetSelected(props.side);
        setAssetSelection(AssetSelection.Asset);
    };

    const { setAssetSelected, setAssetSelection } = useCreateContext();

    return (
        <button
            type="button"
            class={`asset-wrap${bitcoinOnly() ? " no-select" : ""}`}
            onClick={openSelect}>
            <div
                data-testid={`asset-${props.side}`}
                class={`asset asset-${getAssetDisplaySymbol(props.signal())}`}
                data-network={getNetworkBadge(props.signal())}>
                <div class="asset-selection">
                    <span class="icon" />
                    <span class="asset-text" />
                    <span class="arrow-down" />
                </div>
            </div>
        </button>
    );
};

export default Asset;
