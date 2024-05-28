import { BigNumber } from "bignumber.js";
import { createEffect, on } from "solid-js";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { calculateSendAmount } from "../utils/calculate";
import { probeUserInput } from "../utils/compat";
import {
    decodeInvoice,
    extractAddress,
    extractInvoice,
    isLnurl,
} from "../utils/invoice";
import { validateInvoice } from "../utils/validation";

const InvoiceInput = () => {
    let inputRef: HTMLTextAreaElement;

    const { t, notify } = useGlobalContext();
    const {
        boltzFee,
        minerFee,
        invoice,
        receiveAmount,
        swapType,
        sendAmount,
        amountValid,
        setInvoice,
        setInvoiceValid,
        setInvoiceError,
        setLnurl,
        setReceiveAmount,
        setSendAmount,
        setAssetSend,
        assetSend,
        setAssetReceive,
        setOnchainAddress,
    } = useCreateContext();

    const validate = (input: HTMLTextAreaElement) => {
        const val = input.value.trim();

        const address = extractAddress(val);
        const actualAsset = probeUserInput(LN, address);

        // Auto switch direction based on address
        if (actualAsset !== LN && actualAsset !== null) {
            setAssetSend(assetSend() === actualAsset ? LN : assetSend());
            setAssetReceive(actualAsset);
            setOnchainAddress(address);
            notify("success", t("switch_paste"));
            return;
        }

        const inputValue = extractInvoice(val);

        try {
            input.setCustomValidity("");
            setInvoiceError("");
            input.classList.remove("invalid");
            if (isLnurl(inputValue)) {
                setLnurl(inputValue);
            } else {
                const sats = validateInvoice(inputValue);
                setReceiveAmount(BigNumber(sats));
                setSendAmount(
                    calculateSendAmount(
                        BigNumber(sats),
                        boltzFee(),
                        minerFee(),
                        swapType(),
                    ),
                );
                setInvoice(inputValue);
                setLnurl("");
                setInvoiceValid(true);
            }
        } catch (e) {
            setInvoiceValid(false);
            setLnurl("");
            setInvoiceError(e.message);
            if (inputValue.length !== 0) {
                input.setCustomValidity(t(e.message));
                input.classList.add("invalid");
            }
        }
    };

    createEffect(
        on([amountValid, invoice], () => {
            if (swapType() === SwapType.Submarine) {
                validate(inputRef);
            }
        }),
    );

    // reset invoice if amount is changed
    createEffect(
        on([receiveAmount, sendAmount, invoice], () => {
            const amount = Number(receiveAmount());
            if (
                invoice() !== "" &&
                !isLnurl(invoice()) &&
                !receiveAmount().isZero()
            ) {
                try {
                    const inv = decodeInvoice(invoice());
                    if (inv.satoshis !== amount) {
                        setInvoice("");
                    }
                } catch (e) {
                    return;
                }
            }
        }),
    );

    return (
        <textarea
            required
            ref={inputRef}
            onInput={(e) => validate(e.currentTarget)}
            onKeyUp={(e) => validate(e.currentTarget)}
            onPaste={(e) => validate(e.currentTarget)}
            id="invoice"
            data-testid="invoice"
            name="invoice"
            value={invoice()}
            autocomplete="off"
            placeholder={t("create_and_paste")}></textarea>
    );
};

export default InvoiceInput;
