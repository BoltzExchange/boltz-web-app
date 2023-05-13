import { useI18n } from "@solid-primitives/i18n";
import { setAsset, setAssetSelect, assetSelect } from "../signals";
import bitcoin_svg from "../assets/bitcoin-icon.svg";
import liquid_svg from "../assets/liquid-icon.svg";


const SelectAsset = () => {
    const [t] = useI18n();

    const changeAsset = (asset) => {
        setAsset(asset);
        setAssetSelect(false);
    };

    return (
        <div
            class="frame assets-select"
            style={assetSelect() ? "display: block;" : "display: none;"}>
            <h2>{t("select_asset")}</h2>
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
            <div className="asset-select" onClick={() => changeAsset("BTC")}>
                <img src={bitcoin_svg} alt="bitcoin" />
                <span>bitcoin</span>
            </div>
            <div className="asset-select" onClick={() => changeAsset("L-BTC")}>
                <img src={liquid_svg} alt="liquid bitcoin" />
                <span>liquid</span>
            </div>
        </div>
    );
};

export default SelectAsset;
