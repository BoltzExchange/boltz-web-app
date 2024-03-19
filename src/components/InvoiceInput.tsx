import { BigNumber } from "bignumber.js";
import { createEffect, on } from "solid-js";

import { RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { calculateSendAmount } from "../utils/calculate";
import { decodeInvoice, extractInvoice, isLnurl } from "../utils/invoice";
import { validateInvoice } from "../utils/validation";

const InvoiceInput = () => {
    let inputRef: HTMLTextAreaElement;

    const { t } = useGlobalContext();
    const {
        asset,
        boltzFee,
        minerFee,
        invoice,
        receiveAmount,
        reverse,
        sendAmount,
        amountValid,
        setInvoice,
        setInvoiceValid,
        setInvoiceError,
        setLnurl,
        setReceiveAmount,
        setSendAmount,
    } = useCreateContext();

    const validate = (input: HTMLTextAreaElement) => {
        const inputValue = extractInvoice(input.value.trim());
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
                        reverse(),
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
            if (!reverse() && asset() !== RBTC) {
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
