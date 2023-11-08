import t from "../i18n/index.js";
import { getAddress, getNetwork } from "../compat.js";
import { asset, setAddressValid, setOnchainAddress } from "../signals.js";

const AddressInput = () => {
    const validateAddress = (input) => {
        let inputValue = input.value.trim();

        try {
            // validate btc address
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
