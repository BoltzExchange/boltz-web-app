import { createEffect, on } from "solid-js";

import { LN, RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { probeUserInput } from "../utils/compat";
import { extractAddress, extractInvoice } from "../utils/invoice";

const AddressInput = () => {
    let inputRef: HTMLInputElement;

    const { t, notify } = useGlobalContext();
    const {
        asset,
        assetReceive,
        reverse,
        amountValid,
        onchainAddress,
        setAddressValid,
        setAssetReceive,
        setAssetSend,
        setOnchainAddress,
        setButtonLabel,
        setInvoice,
    } = useCreateContext();

    const validateAddress = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);
        const invoice = extractInvoice(inputValue);

        try {
            const assetName = asset();

            const actualAsset = probeUserInput(assetName, address);

            switch (actualAsset) {
                case LN:
                    setAssetReceive(LN);
                    setAssetSend(asset());
                    setInvoice(invoice);
                    notify("success", t("switch_paste"));
                    break;

                case null:
                    throw new Error();

                default:
                    if (assetName !== actualAsset) {
                        setAssetReceive(actualAsset);
                        notify("success", t("switch_paste"));
                    }

                    input.setCustomValidity("");
                    input.classList.remove("invalid");
                    setAddressValid(true);
                    setOnchainAddress(address);
                    break;
            }
        } catch (e) {
            const msg = t("invalid_address", { asset: asset() });
            setAddressValid(false);
            input.classList.add("invalid");
            input.setCustomValidity(msg);
            if (amountValid()) {
                setButtonLabel({
                    key: "invalid_address",
                    params: { asset: asset() },
                });
            }
        }
    };

    createEffect(
        on([amountValid, onchainAddress, assetReceive], () => {
            if (reverse() && asset() !== RBTC) {
                validateAddress(inputRef);
            }
        }),
    );

    return (
        <input
            ref={inputRef}
            required
            onInput={(e) => validateAddress(e.currentTarget)}
            onKeyUp={(e) => validateAddress(e.currentTarget)}
            onPaste={(e) => validateAddress(e.currentTarget)}
            type="text"
            id="onchainAddress"
            data-testid="onchainAddress"
            name="onchainAddress"
            autocomplete="off"
            placeholder={t("onchain_address", { asset: asset() })}
            value={onchainAddress()}
        />
    );
};

export default AddressInput;
