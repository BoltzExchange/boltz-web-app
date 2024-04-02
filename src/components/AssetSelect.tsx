import { IoClose } from "solid-icons/io";

import { config } from "../config";
import { LN, sideSend } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";

const SelectAsset = () => {
    const assets = Object.keys(config.assets);
    assets.push(LN);

    const setSelectAsset = (isSend: boolean, asset: string) => {
        const setter = isSend ? setAssetSend : setAssetReceive;
        setter(asset);
    };

    const { t, fetchPairs } = useGlobalContext();

    const {
        assetReceive,
        assetSelect,
        assetSelected,
        assetSend,
        setAsset,
        setAssetReceive,
        setAssetSelect,
        setAssetSend,
        setInvoice,
        setOnchainAddress,
    } = useCreateContext();

    const changeAsset = (newAsset: string) => {
        if (isSelected(newAsset)) return;

        // clear invoice and address
        setInvoice("");
        setOnchainAddress("");

        // set main asset only if it is not LN
        if (newAsset !== LN) {
            setAsset(newAsset);
        }

        const isSend = assetSelected() === sideSend;

        // Only one side can be lightning
        // Set the other side to the previously selected asset
        // Or, if something else than lightning was selected, set the other side to lightning
        if (newAsset === LN) {
            setSelectAsset(!isSend, isSend ? assetSend() : assetReceive());
        } else if ((isSend ? assetReceive() : assetSend()) !== LN) {
            setSelectAsset(!isSend, LN);
        }

        setSelectAsset(isSend, newAsset);

        fetchPairs();
    };

    const isSelected = (asset: string) => {
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
                    direction:
                        assetSelected() === sideSend ? t("send") : t("receive"),
                })}
            </h2>
            <span class="close" onClick={() => setAssetSelect(!assetSelect())}>
                <IoClose />
            </span>
            <hr />
            {assets.map((asset) => (
                <div
                    class={`asset-select asset-${asset}`}
                    data-selected={isSelected(asset)}
                    data-testid={`select-${asset}`}
                    onClick={() => changeAsset(asset)}>
                    <span class="icon"></span>
                    <span class="asset-text"></span>
                </div>
            ))}
        </div>
    );
};

export default SelectAsset;
