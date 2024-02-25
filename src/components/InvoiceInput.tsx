import { BigNumber } from "bignumber.js";
import { createEffect, on } from "solid-js";

import { RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { calculateSendAmount } from "../utils/calculate";
import { isBoltzClient } from "../utils/helper";
import { moduleLoaded, invoice as util } from "../utils/lazy";
import { setButtonLabel } from "./CreateButton";

const InvoiceInput = () => {
    let inputRef: HTMLTextAreaElement;

    const { t, denomination } = useGlobalContext();
    const {
        asset,
        boltzFee,
        minerFee,
        invoice,
        receiveAmount,
        receiveAmountFormatted,
        reverse,
        sendAmount,
        amountValid,
        setInvoice,
        setInvoiceValid,
        setLnurl,
        setReceiveAmount,
        setSendAmount,
    } = useCreateContext();

    const loaded = moduleLoaded(util);

    const validate = (input: HTMLTextAreaElement) => {
        if (!loaded()) return;
        const inputValue = util.extractInvoice(input.value.trim());
        try {
            if (isBoltzClient() && inputValue == "") {
                setInvoiceValid(true);
            } else {
                if (util.isLnurl(inputValue)) {
                    setButtonLabel({ key: "fetch_lnurl" });
                    setLnurl(inputValue);
                } else {
                    const sats = util.validateInvoice(inputValue);
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
            }
            input.setCustomValidity("");
            input.classList.remove("invalid");
        } catch (e) {
            setInvoiceValid(false);
            setLnurl("");
            input.setCustomValidity(t(e.message));
            if (amountValid()) {
                setButtonLabel({ key: e.message });
            }
            input.classList.add("invalid");
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
                !util.isLnurl(invoice()) &&
                !receiveAmount().isZero()
            ) {
                try {
                    const inv = util.decodeInvoice(invoice());
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
            disabled={!loaded()}
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
