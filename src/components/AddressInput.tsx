import { createEffect } from "solid-js";

import { RBTC } from "../consts";
import t from "../i18n";
import {
    asset,
    reverse,
    sendAmountValid,
    setAddressValid,
    setOnchainAddress,
} from "../signals";
import { extractAddress } from "../utils/invoice";
import { validateOnchainAddress } from "../utils/validation";
import { setButtonLabel } from "./CreateButton";

const AddressInput = () => {
    let inputRef: HTMLInputElement;

    const validateAddress = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);
        console.log("address", address);

        try {
            const assetName = asset();
            validateOnchainAddress(address, assetName);
            input.setCustomValidity("");
            input.classList.remove("invalid");
            setAddressValid(true);
            setOnchainAddress(address);
        } catch (e) {
            console.log("invalid address", e.message);
            const msg = t("invalid_address", { asset: asset() });
            setAddressValid(false);
            input.classList.add("invalid");
            input.setCustomValidity(msg);
            setButtonLabel(msg);
        }
    };

    createEffect(() => {
        if (sendAmountValid() && reverse() && asset() !== RBTC) {
            validateAddress(inputRef);
        }
    });

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
            placeholder={t("onchain_address", { asset: asset() })}
        />
    );
};

export default AddressInput;
