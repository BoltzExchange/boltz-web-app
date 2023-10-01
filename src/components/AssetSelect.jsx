import { useI18n } from "@solid-primitives/i18n";
import { fetchPairs } from "../helper";
import { LN, assets, sideSend } from "../consts";
import {
    asset,
    setAsset,
    assetSend,
    setAssetSend,
    assetReceive,
    setAssetReceive,
    setAssetSelect,
    assetSelect,
    assetSelected,
} from "../signals";

const SelectAsset = () => {
    const [t] = useI18n();

    const setAsset = (isSend, asset) => {
        const setter = isSend ? setAssetSend : setAssetReceive;
        setter(asset);
    };

    const changeAsset = (newAsset) => {
        if (isSelected(newAsset)) return;

        // set main asset only if it is not LN
        if (newAsset !== LN) {
            setAsset(newAsset);
        }

        const isSend = assetSelected() === sideSend;

        // Only one side can be lightning; set the other side to the previously selected asset
        if (newAsset === LN) {
            setAsset(!isSend, isSend ? assetSend() : assetReceive());
        }

        setAsset(isSend, newAsset);

        fetchPairs();
    };

    const isSelected = (asset) => {
        return (
            asset ===
            (assetSelected() === sideSend ? assetSend() : assetReceive())
        );
    };

    return (
        <div
            class="frame assets-select"
            onClick={() => setAssetSelect(false)}
            style={assetSelect() ? "display: block;" : "display: none;"}>
            <h2>
                {t("select_asset", {
                    direction: assetSelected() === 1 ? t("send") : t("receive"),
                })}
            </h2>
            <svg
                id="close"
                viewBox="0 0 100 100"
                width="50"
                onClick={() => setAssetSelect(!assetSelect())}>
                <path
                    class="line top"
                    d="m 70,33 h -40 c 0,0 -8.5,-0.149796 -8.5,8.5 0,8.649796 8.5,8.5 8.5,8.5 h 20 v -20"
                />
                <path
                    class="line bottom"
                    d="m 30,67 h 40 c 0,0 8.5,0.149796 8.5,-8.5 0,-8.649796 -8.5,-8.5 -8.5,-8.5 h -20 v 20"
                />
            </svg>
            <hr />
            {assets.map((asset) => (
                <div
                    class={`asset-select asset-${asset}`}
                    data-selected={isSelected(asset)}
                    onClick={() => changeAsset(asset)}>
                    <span class="icon"></span>
                    <span class="asset-text"></span>
                </div>
            ))}
        </div>
    );
};

export default SelectAsset;
