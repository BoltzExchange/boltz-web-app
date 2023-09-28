import { useI18n } from "@solid-primitives/i18n";
import { fetchPairs } from "../helper";
import {
    asset,
    reverse,
    setReverse,
    setAsset,
    asset1,
    setAsset1,
    asset2,
    setAsset2,
    setAssetSelect,
    assetSelect,
    assetSelected,
} from "../signals";

const SelectAsset = () => {
    const [t] = useI18n();

    const changeAsset = (new_asset) => {
        if (isSelected(new_asset)) return;

        if (new_asset === "LN" || isSelected("LN")) {
            setReverse(!reverse());
        }

        // set main asset only if it is not LN
        if (new_asset !== "LN") {
            setAsset(new_asset);
        }

        if (assetSelected() === 1 && new_asset !== "LN") {
            setAsset1(new_asset);
            setAsset2("LN");
        } else if (assetSelected() === 2 && new_asset !== "LN") {
            setAsset1("LN");
            setAsset2(new_asset);
        } else if (assetSelected() === 1 && new_asset === "LN") {
            setAsset1("LN");
            setAsset2(asset());
        } else if (assetSelected() === 2 && new_asset === "LN") {
            setAsset1(asset());
            setAsset2("LN");
        }

        fetchPairs();
    };

    const isSelected = (new_asset) => {
        if (assetSelected() === 1) {
            return new_asset === asset1();
        } else if (assetSelected() === 2) {
            return new_asset === asset2();
        }
        return false;
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
            <div
                class="asset-select asset-BTC"
                data-selected={isSelected("BTC")}
                onClick={() => changeAsset("BTC")}>
                <span class="icon"></span>
                <span class="asset-text"></span>
            </div>
            <div
                class="asset-select asset-L-BTC"
                data-selected={isSelected("L-BTC")}
                onClick={() => changeAsset("L-BTC")}>
                <span class="icon"></span>
                <span class="asset-text"></span>
            </div>
            <div
                class="asset-select asset-LN"
                data-selected={isSelected("LN")}
                onClick={() => changeAsset("LN")}>
                <span class="icon"></span>
                <span class="asset-text"></span>
            </div>
        </div>
    );
};

export default SelectAsset;
