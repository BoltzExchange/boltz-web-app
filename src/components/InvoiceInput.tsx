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
import { decodeInvoice, extractInvoice, isLnurl } from "../utils/invoice";
import { validateInvoice } from "../utils/validation";
import { setButtonLabel } from "./CreateButton";

const InvoiceInput = () => {
    let inputRef: HTMLTextAreaElement;

    const validate = (input: HTMLTextAreaElement) => {
        const inputValue = extractInvoice(input.value.trim());
        try {
            if (isLnurl(inputValue)) {
                setButtonLabel({ key: "fetch_lnurl" });
                setLnurl(inputValue);
            } else {
                const sats = validateInvoice(inputValue);
                setReceiveAmount(sats);
                setSendAmount(calculateSendAmount(sats));
                setInvoice(inputValue);
                setLnurl(false);
                setInvoiceValid(true);
            }
            input.setCustomValidity("");
            input.classList.remove("invalid");
        } catch (e) {
            setInvoiceValid(false);
            setLnurl(false);
            input.setCustomValidity(t(e.message));
            setButtonLabel({ key: e.message });
            input.classList.add("invalid");
        }
    };

    createEffect(
        on([sendAmountValid, invoice], () => {
            if (!reverse() && asset() !== RBTC) {
                validate(inputRef);
            }
        }),
    );

    // reset invoice if amount is changed
    createEffect(
        on([receiveAmount, sendAmount, invoice], () => {
            const amount = Number(receiveAmount());
            if (invoice() !== "" && !isLnurl(invoice())) {
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
            placeholder={t("create_and_paste", {
                amount: receiveAmountFormatted(),
                denomination: denomination(),
            })}></textarea>
    );
};

export default InvoiceInput;
