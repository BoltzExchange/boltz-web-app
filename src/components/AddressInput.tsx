import { createEffect, on } from "solid-js";

import { RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { invoice, moduleLoaded, address as util } from "../utils/lazy";
import { setButtonLabel } from "./CreateButton";

const AddressInput = ({ allowEmpty }: { allowEmpty?: boolean }) => {
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
    } = useCreateContext();

    const loaded = moduleLoaded(util, invoice);

    const validateAddress = (input: HTMLInputElement) => {
        if (!loaded()) return;
        const inputValue = input.value.trim();
        const address = invoice.extractAddress(inputValue);

        try {
            if (address == "" && allowEmpty) {
                setAddressValid(true);
            } else {
                const assetName = asset();
                util.decodeAddress(assetName, address);
                input.setCustomValidity("");
                input.classList.remove("invalid");
                setAddressValid(true);
                setOnchainAddress(address);
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
            disabled={!loaded()}
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
