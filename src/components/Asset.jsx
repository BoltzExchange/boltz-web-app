import { pairs } from "../config";
import { setAssetSelect, assetSelect } from "../signals";
import "../style/asset.scss";

const Asset = ({ id }) => {
    const setAssetPair = () => {
        if (Object.keys(pairs).length <= 1) {
            return;
        }
        setAssetSelect(!assetSelect());
    };

    return (
        <div class="asset-wrap" onClick={setAssetPair}>
            <div class={`asset asset-${id}`}>
                <div class="asset-selected">
                    <span class={`icon icon-${id}`}></span>
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
