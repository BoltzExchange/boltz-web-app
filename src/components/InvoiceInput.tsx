import { createEffect } from "solid-js";

import { RBTC } from "../consts";
import t from "../i18n";
import {
    asset,
    denomination,
    invoice,
    receiveAmountFormatted,
    reverse,
    sendAmountValid,
    setInvoice,
    setInvoiceValid,
    setLnurl,
    setReceiveAmount,
    setSendAmount,
} from "../signals";
import { calculateSendAmount } from "../utils/calculate";
import { isLnurl } from "../utils/invoice";
import { validateInvoice } from "../utils/validation";
import { setButtonLabel } from "./CreateButton";

const InvoiceInput = ({ validateAmount }) => {
    let inputRef: HTMLTextAreaElement;

    const validateAddress = (input: HTMLTextAreaElement) => {
        const inputValue = input.value.trim();
        try {
            if (isLnurl(inputValue)) {
                setButtonLabel(t("fetch_lnurl"));
                setLnurl(inputValue);
            } else {
                const sats = validateInvoice(inputValue);
                setReceiveAmount(BigInt(sats));
                setSendAmount(calculateSendAmount(sats));
                validateAmount();
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
