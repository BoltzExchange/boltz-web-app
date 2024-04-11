import { IoClose } from "solid-icons/io";

import { config } from "../config";
import { LN } from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";

const SelectAsset = () => {
    // TODO: only show possible pairs
    const assets = Object.keys(config.assets);
    assets.push(LN);

    const { t, fetchPairs } = useGlobalContext();

    const {
        assetReceive,
        assetSelect,
        assetSelected,
        assetSend,
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

        // set new asset and swap assets if the other asset is the same
        if (assetSelected() === Side.Send) {
            if (assetReceive() === newAsset) {
                setAssetReceive(assetSend());
            }
            setAssetSend(newAsset);
        } else {
            if (assetSend() === newAsset) {
                setAssetSend(assetReceive());
            }
            setAssetReceive(newAsset);
        }

        fetchPairs();
    };

    const isSelected = (asset: string) => {
        return (
            asset ===
            (assetSelected() === Side.Send ? assetSend() : assetReceive())
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
