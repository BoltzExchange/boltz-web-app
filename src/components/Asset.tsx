import type { Accessor } from "solid-js";

import { getNetworkBadge } from "../consts/Assets";
import type { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import "../style/asset.scss";

const Asset = (props: { side: Side; signal: Accessor<string> }) => {
    const openSelect = () => {
        setAssetSelected(props.side);
        setAssetSelect(true);
    };

    const { setAssetSelected, setAssetSelect } = useCreateContext();

    return (
        <div class="asset-wrap" onClick={openSelect}>
            <div
                data-testid={`asset-${props.side}`}
                class={`asset asset-${props.signal()}`}
                data-network={getNetworkBadge(props.signal())}>
                <div class="asset-selection">
                    <span class="icon" />
                    <span class="asset-text" />
                    <span class="arrow-down" />
                </div>
            </div>
        </div>
    );
};

export default Asset;
