import { pairs } from "../config";
import { setAssetSelect, assetSelect, setAssetSelected } from "../signals";
import "../style/asset.scss";

const Asset = ({ id, signal }) => {
    id = parseInt(id);

    const openSelect = () => {
        if (Object.keys(pairs).length <= 1) {
            return;
        }
        setAssetSelect(!assetSelect());
        setAssetSelected(id);
    };

    return (
        <div class="asset-wrap" onClick={openSelect}>
            <div class={`asset asset-${signal()}`}>
                <div class="asset-selection">
                    <span class="icon"></span>
                    <span class="asset-text"></span>
                    <Show when={Object.keys(pairs).length > 1}>
                        <span class="arrow-down"></span>
                    </Show>
                </div>
            </div>
            <div class="assets-select"></div>
        </div>
    );
};

export default Asset;
