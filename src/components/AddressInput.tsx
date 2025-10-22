import log from "loglevel";
import { createEffect, createSignal, on } from "solid-js";

import { LN, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { probeUserInput } from "../utils/compat";
import { formatError } from "../utils/errors";
import { formatAddress } from "../utils/helper";
import { extractAddress, extractInvoice } from "../utils/invoice";

const AddressInput = () => {
    let inputRef: HTMLInputElement;

    const { t, notify } = useGlobalContext();
    const {
        assetReceive,
        swapType,
        amountValid,
        onchainAddress,
        setAddressValid,
        setAssetReceive,
        setAssetSend,
        assetSend,
        setOnchainAddress,
        setInvoice,
        sendAmount,
    } = useCreateContext();

    const [isFormatting, setIsFormatting] = createSignal(false);

    const handleInputChange = (input: HTMLInputElement) => {
        if (isFormatting()) return;

        setIsFormatting(true);

        const cursorPos = input.selectionStart || 0;
        const oldValue = input.value;

        const inputValue = input.value.replace(/\s/g, "");
        const address = extractAddress(inputValue);
        const invoice = extractInvoice(inputValue);

        try {
            const assetName = assetReceive();
            const actualAsset = probeUserInput(assetName, address);

            switch (actualAsset) {
                case LN:
                    setAssetReceive(LN);
                    if (assetSend() === LN) {
                        setAssetSend(assetName);
                    }
                    setInvoice(invoice);
                    notify("success", t("switch_paste"));
                    setIsFormatting(false);
                    break;

                case null:
                    throw new Error();

                default: {
                    if (assetName !== actualAsset) {
                        setAssetSend(assetReceive());
                        setAssetReceive(actualAsset);
                        notify("success", t("switch_paste"));
                    }

                    input.setCustomValidity("");
                    input.classList.remove("invalid");
                    setAddressValid(true);
                    setOnchainAddress(address);

                    const formattedAddress = formatAddress(address);

                    const charsBeforeCursor = oldValue
                        .substring(0, cursorPos)
                        .replace(/\s/g, "").length;

                    let newCursorPos = 0;
                    if (charsBeforeCursor > 0) {
                        let charCount = 0;
                        for (let i = 0; i < formattedAddress.length; i++) {
                            if (formattedAddress[i] !== " ") {
                                charCount++;
                                if (charCount === charsBeforeCursor) {
                                    newCursorPos = i + 1;
                                    break;
                                }
                            }
                        }
                    }

                    input.value = formattedAddress;
                    requestAnimationFrame(() => {
                        input.setSelectionRange(newCursorPos, newCursorPos);
                    });

                    setIsFormatting(false);
                    break;
                }
            }
        } catch (e) {
            setAddressValid(false);

            if (inputValue.length !== 0) {
                log.debug(`Invalid address input: ${formatError(e)}`);

                const msg = t("invalid_address", { asset: assetReceive() });
                input.classList.add("invalid");
                input.setCustomValidity(msg);
            }
            setIsFormatting(false);
        }
    };

    createEffect(
        on([amountValid, onchainAddress], () => {
            if (swapType() !== SwapType.Submarine && inputRef)
                handleInputChange(inputRef);
        }),
    );

    createEffect(
        on([amountValid, onchainAddress, assetReceive], () => {
            if (
                sendAmount().isGreaterThan(0) &&
                swapType() !== SwapType.Submarine &&
                assetReceive() !== RBTC &&
                onchainAddress() === ""
            )
                setAddressValid(false);
        }),
    );

    createEffect(
        on(onchainAddress, () => {
            if (onchainAddress() && inputRef && !isFormatting())
                inputRef.value = formatAddress(onchainAddress());
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
            placeholder={t("onchain_address", { asset: assetReceive() })}
            value={formatAddress(onchainAddress())}
        />
    );
};

export default AddressInput;
