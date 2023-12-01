import { Show, createEffect } from "solid-js";

import { RBTC } from "../consts";
import t from "../i18n";
import {
    asset,
    reverse,
    sendAmountValid,
    setAddressValid,
    setOnchainAddress,
} from "../signals";
import { validateOnchainAddress } from "../utils/validation";
import { setButtonLabel } from "./CreateButton";

const AddressInput = () => {
    let inputRef: HTMLInputElement;
    const validateAddress = () => {
        const input = inputRef;
        const inputValue = input.value.trim();

        try {
            const assetName = asset();
            validateOnchainAddress(inputValue, assetName);
            input.setCustomValidity("");
            input.classList.remove("invalid");
            setAddressValid(true);
            setOnchainAddress(inputValue);
        } catch (e) {
            const msg = t("invalid_address", { asset: asset() });
            setAddressValid(false);
            input.classList.add("invalid");
            input.setCustomValidity(msg);
            setButtonLabel(msg);
        }
    };

    createEffect(() => {
        if (sendAmountValid() && reverse() && asset() !== RBTC) {
            validateAddress();
        }
    });

    return (
        <input
            ref={inputRef}
            required
            onInput={() => validateAddress()}
            onKeyUp={() => validateAddress()}
            onPaste={() => validateAddress()}
            type="text"
            id="onchainAddress"
            name="onchainAddress"
            placeholder={t("onchain_address", { asset: asset() })}
        />
    );
};

export default AddressInput;
