import { pairs } from "../config";
import { setAssetSelect, assetSelect } from "../signals";
import "../style/asset.sass";

const Asset = ({ id }) => {
    const setAssetPair = () => {
        if (pairs.length <= 1) {
            return false;
        }
        setAssetSelect(!assetSelect());
    };

    return (
        <div class="asset-wrap" onClick={setAssetPair}>
            <div class={`asset asset-${id}`}>
                <div class="asset-selected">
                    <span class={`icon icon-${id}`}></span>
                    <span class="asset-text"></span>
                    <Show when={pairs.length > 1}>
                        <span class="arrow-down"></span>
                    </Show>
                </div>
            </div>
            <div class="assets-select"></div>
        </div>
    );
};

export default Asset;
