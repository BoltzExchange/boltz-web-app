import { IoClose } from "solid-icons/io";
import { createMemo } from "solid-js";

import { config } from "../config";
import { LN } from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";

const SelectAsset = () => {
    const assets = Object.keys(config.assets);
    assets.push(LN);

    const { t, fetchPairs, pairs } = useGlobalContext();

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

    const lookup = {};

    createMemo(() => {
        if (pairs()) {
            const swapTypes = Object.keys(pairs());
            for (const asset of assets) {
                lookup[asset] = [];
            }
            for (const swapType of swapTypes) {
                const swapTypePairs = Object.keys(pairs()[swapType]);
                for (const pair of swapTypePairs) {
                    const pairData = Object.keys(pairs()[swapType][pair]);
                    switch (swapType) {
                        case "chain":
                            lookup[pair] = lookup[pair].concat(pairData);
                            break;
                        case "reverse":
                            lookup[LN] = lookup[LN].concat(pairData);
                            break;
                        case "submarine":
                            lookup[pair].push(LN);
                            break;
                    }
                }
            }
        }
    });

    const changeAsset = (newAsset: string) => {
        if (isSelected(newAsset)) return;
        if (isInvalidPair(newAsset) && !isOtherAsset(newAsset)) return;

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

    const isInvalidPair = (newAsset: string) => {
        const assetFrom =
            assetSelected() === Side.Send ? newAsset : assetSend();
        const assetTo =
            assetSelected() === Side.Send ? assetReceive() : newAsset;
        if (!lookup[assetFrom]) return false;
        return lookup[assetFrom].indexOf(assetTo) === -1;
    };

    const isOtherAsset = (asset: string) => {
        return (
            asset ===
            (assetSelected() === Side.Send ? assetReceive() : assetSend())
        );
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
                    data-disabled={isInvalidPair(asset)}
                    data-other={isOtherAsset(asset)}
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
