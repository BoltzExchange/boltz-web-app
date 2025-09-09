import log from "loglevel";
import { createEffect, on } from "solid-js";

import { LN } from "../consts/Assets";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { probeUserInput } from "../utils/compat";
import { formatError } from "../utils/errors";
import { extractAddress, extractInvoice } from "../utils/invoice";
import Pair, { RequiredInput } from "../utils/pair";

const AddressInput = () => {
    let inputRef: HTMLInputElement;

    const { t, notify, pairs } = useGlobalContext();
    const {
        pair,
        setPair,
        amountValid,
        onchainAddress,
        setAddressValid,
        setOnchainAddress,
        setInvoice,
        sendAmount,
    } = useCreateContext();

    const handleInputChange = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);
        const invoice = extractInvoice(inputValue);

        try {
            const assetName = pair().toAsset;
            const actualAsset = probeUserInput(assetName, address);

            switch (actualAsset) {
                case LN:
                    setPair(new Pair(pairs(), pair().fromAsset, LN));
                    if (pair().fromAsset === LN) {
                        setPair(new Pair(pairs(), assetName, LN));
                    }
                    setInvoice(invoice);
                    notify("success", t("switch_paste"));
                    break;

                case null:
                    throw new Error();

                default:
                    if (assetName !== actualAsset) {
                        setPair(new Pair(pairs(), pair().toAsset, actualAsset));
                        notify("success", t("switch_paste"));
                    }

                    input.setCustomValidity("");
                    input.classList.remove("invalid");
                    setAddressValid(true);
                    setOnchainAddress(address);
                    break;
            }
        } catch (e) {
            setAddressValid(false);

            if (inputValue.length !== 0) {
                log.debug(`Invalid address input: ${formatError(e)}`);

                const msg = t("invalid_address", { asset: pair().toAsset });
                input.classList.add("invalid");
                input.setCustomValidity(msg);
            }
        }
    };

    createEffect(
        on([amountValid, onchainAddress], () => {
            if (pair().requiredInput === RequiredInput.Address && inputRef) {
                handleInputChange(inputRef);
            }
        }),
    );

    createEffect(
        on([amountValid, onchainAddress, pair], () => {
            if (
                sendAmount().isGreaterThan(0) &&
                pair().requiredInput === RequiredInput.Address &&
                onchainAddress() === ""
            ) {
                setAddressValid(false);
            }
        }),
    );

    return (
        <input
            ref={inputRef}
            required
            onInput={(e) => handleInputChange(e.currentTarget)}
            onKeyUp={(e) => handleInputChange(e.currentTarget)}
            onPaste={(e) => handleInputChange(e.currentTarget)}
            type="text"
            id="onchainAddress"
            data-testid="onchainAddress"
            name="onchainAddress"
            autocomplete="off"
            placeholder={t("onchain_address", { asset: pair().toAsset })}
            value={onchainAddress()}
        />
    );
};

export default AddressInput;
