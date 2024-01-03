import { createEffect, on } from "solid-js";

import { RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import t from "../i18n";
import { extractAddress } from "../utils/invoice";
import { setButtonLabel } from "./CreateButton";

const AddressInput = () => {
    let inputRef: HTMLInputElement;
    const {
        asset,
        onchainAddress,
        reverse,
        sendAmountValid,
        setAddressValid,
        setOnchainAddress,
    } = useCreateContext();

    const validateAddress = (input: EventTarget & HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);

        try {
            const assetName = asset();
            decodeAddress(assetName, address);
            input.setCustomValidity("");
            input.classList.remove("invalid");
            setAddressValid(true);
            setOnchainAddress(address);
        } catch (e) {
            const msg = t("invalid_address", { asset: asset() });
            setAddressValid(false);
            input.classList.add("invalid");
            input.setCustomValidity(msg);
            setButtonLabel({
                key: "invalid_address",
                params: { asset: asset() },
            });
        }
    };

    createEffect(
        on([sendAmountValid, onchainAddress], () => {
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
            name="onchainAddress"
            autocomplete="off"
            placeholder={t("onchain_address", { asset: asset() })}
            value={onchainAddress()}
        />
    );
};

export default AddressInput;
