import { createEffect, on } from "solid-js";

import { RBTC } from "../consts";
import t from "../i18n";
import {
    asset,
    denomination,
    invoice,
    receiveAmount,
    receiveAmountFormatted,
    reverse,
    sendAmount,
    sendAmountValid,
    setInvoice,
    setInvoiceValid,
    setLnurl,
    setReceiveAmount,
    setSendAmount,
} from "../signals";
import { calculateSendAmount } from "../utils/calculate";
import { isInvoice, isLnurl } from "../utils/invoice";
import { validateInvoice } from "../utils/validation";
import { setButtonLabel } from "./CreateButton";

const InvoiceInput = () => {
    let inputRef: HTMLTextAreaElement;

    const validateAddress = (input: HTMLTextAreaElement) => {
        const inputValue = input.value.trim();
        try {
            if (isLnurl(inputValue)) {
                setButtonLabel(t("fetch_lnurl"));
                setLnurl(inputValue);
            } else {
                const sats = validateInvoice(inputValue);
                setReceiveAmount(sats);
                setSendAmount(calculateSendAmount(sats));
                setInvoice(inputValue);
                setLnurl(false);
            }
            setInvoiceValid(true);
            input.setCustomValidity("");
            input.classList.remove("invalid");
        } catch (e) {
            setInvoiceValid(false);
            input.setCustomValidity(e.message);
            setButtonLabel(e.message);
            input.classList.add("invalid");
        }
    };

    createEffect(() => {
        if (sendAmountValid() && !reverse() && asset() !== RBTC) {
            validateAddress(inputRef);
        }
    });

    createEffect(() => {
        if (invoice()) {
            validateAddress(inputRef);
        }
    });

    // reset invoice if amount is changed
    createEffect(() => {
        if (sendAmount() > 0) {
            setInvoice("");
        }
    });

    return (
        <textarea
            required
            ref={inputRef}
            onInput={(e) => validateAddress(e.currentTarget)}
            onKeyUp={(e) => validateAddress(e.currentTarget)}
            onPaste={(e) => validateAddress(e.currentTarget)}
            id="invoice"
            data-testid="invoice"
            name="invoice"
            value={invoice()}
            placeholder={t("create_and_paste", {
                amount: receiveAmountFormatted(),
                denomination: denomination(),
            })}></textarea>
    );
};

export default InvoiceInput;
