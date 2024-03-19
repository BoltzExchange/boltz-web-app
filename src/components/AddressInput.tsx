import { createEffect, on } from "solid-js";

import { RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { decodeAddress } from "../utils/compat";
import { extractAddress } from "../utils/invoice";

const AddressInput = () => {
    let inputRef: HTMLInputElement;

    const { t } = useGlobalContext();
    const {
        asset,
        assetReceive,
        reverse,
        amountValid,
        onchainAddress,
        setAddressValid,
        setOnchainAddress,
        sendAmount,
    } = useCreateContext();

    const validateAddress = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);

        try {
            input.setCustomValidity("");
            input.classList.remove("invalid");
            const assetName = asset();
            decodeAddress(assetName, address);
            setAddressValid(true);
            setOnchainAddress(address);
        } catch (e) {
            setAddressValid(false);
            if (inputValue.length !== 0) {
                const msg = t("invalid_address", { asset: asset() });
                input.classList.add("invalid");
                input.setCustomValidity(msg);
            }
        }
    };

    createEffect(
        on([amountValid, onchainAddress, assetReceive], () => {
            if (
                sendAmount().isGreaterThan(0) &&
                reverse() &&
                asset() !== RBTC
            ) {
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
