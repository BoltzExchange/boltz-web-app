import log from "loglevel";
import { createEffect, on } from "solid-js";
import { btcToSat } from "src/utils/denomination";

import { LN } from "../consts/Assets";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { probeUserInput } from "../utils/compat";
import { formatError } from "../utils/errors";
import {
    extractAddress,
    extractBip21Amount,
    extractInvoice,
} from "../utils/invoice";
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
        setReceiveAmount,
        setSendAmount,
    } = useCreateContext();

    const handleInputChange = async (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        setOnchainAddress(inputValue);

        if (inputValue.length === 0) {
            setAddressValid(false);
            input.classList.remove("invalid");
            input.setCustomValidity("");
            return;
        }

        const address = extractAddress(inputValue);
        const invoice = extractInvoice(inputValue);

        try {
            const assetName = pair().toAsset;
            const actualAsset =
                (await probeUserInput(assetName, invoice)) ??
                (await probeUserInput(assetName, address));

            switch (actualAsset) {
                case LN: {
                    setPair(new Pair(pairs(), pair().fromAsset, LN));
                    if (pair().fromAsset === LN) {
                        setPair(new Pair(pairs(), assetName, LN));
                    }
                    setOnchainAddress("");
                    setInvoice(inputValue); // `InvoiceInput` will handle this validation
                    notify("success", t("switch_paste"));
                    break;
                }

                case null:
                    throw new Error();

                default: {
                    if (assetName !== actualAsset) {
                        setPair(new Pair(pairs(), assetName, actualAsset));
                        notify("success", t("switch_paste"));
                    }

                    const bip21Amount = extractBip21Amount(inputValue);
                    if (bip21Amount) {
                        setReceiveAmount(btcToSat(bip21Amount));
                        setSendAmount(
                            await pair().calculateSendAmount(
                                btcToSat(bip21Amount),
                                pair().minerFees,
                            ),
                        );
                    }

                    input.setCustomValidity("");
                    input.classList.remove("invalid");
                    setAddressValid(true);
                    setOnchainAddress(address);
                    break;
                }
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
        on([amountValid, onchainAddress, pair], () => {
            if (pair().requiredInput === RequiredInput.Address && inputRef) {
                void handleInputChange(inputRef);
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
