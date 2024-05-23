import { IoClose } from "solid-icons/io";

import { config } from "../config";
import { LN } from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";

const SelectAsset = () => {
    const assets = Object.keys(config.assets);
    assets.push(LN);

    const { t, fetchPairs, pairsLookup } = useGlobalContext();

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
        setPairValid,
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
        setPairValid(!isInvalidPair(newAsset));
    };

    const isInvalidPair = (newAsset: string) => {
        const lookup = pairsLookup();
        const assetFrom =
            assetSelected() === Side.Send ? newAsset : assetSend();
        const assetTo =
            assetSelected() === Side.Send ? assetReceive() : newAsset;
        if (!lookup[assetFrom]) return false;
        return lookup[assetFrom].indexOf(assetTo) === -1;
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
