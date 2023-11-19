import { getAddress, getNetwork } from "../compat";
import t from "../i18n";
import { asset, setAddressValid, setOnchainAddress } from "../signals";

const AddressInput = () => {
    const validateAddress = (input: EventTarget & HTMLInputElement) => {
        let inputValue = input.value.trim();

        try {
            const assetName = asset();
            const address = getAddress(assetName);

            address.toOutputScript(inputValue, getNetwork(assetName));
            input.setCustomValidity("");
            input.classList.remove("invalid");
            setAddressValid(true);
            setOnchainAddress(inputValue);
        } catch (e) {
            setAddressValid(false);
            input.setCustomValidity("invalid address");
            input.classList.add("invalid");
        }
    };

    return (
        <input
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
