import log from "loglevel";
import { Show, createEffect, createMemo, on, onMount } from "solid-js";

import AddressInput from "./components/AddressInput";
import Asset from "./components/Asset";
import AssetSelect from "./components/AssetSelect";
import ClickableAmount from "./components/ClickableAmount";
import ConnectMetamask from "./components/ConnectMetamask";
import { CreateButton, setButtonLabel } from "./components/CreateButton";
import Fees from "./components/Fees";
import Reverse from "./components/Reverse";
import { RBTC, sideReceive, sideSend } from "./consts";
import t from "./i18n";
import {
    addressValid,
    amountChanged,
    asset,
    assetReceive,
    assetSelect,
    assetSelected,
    assetSend,
    boltzFee,
    denomination,
    invoice,
    invoiceValid,
    maximum,
    minerFee,
    minimum,
    receiveAmount,
    receiveAmountFormatted,
    reverse,
    sendAmount,
    sendAmountFormatted,
    sendAmountValid,
    setAddressValid,
    setAmountChanged,
    setInvoice,
    setInvoiceValid,
    setLnurl,
    setOnchainAddress,
    setReceiveAmount,
    setReceiveAmountFormatted,
    setSendAmount,
    setSendAmountFormatted,
    setSendAmountValid,
    setValid,
    webln,
} from "./signals";
import { calculateReceiveAmount, calculateSendAmount } from "./utils/calculate";
import {
    calculateDigits,
    convertAmount,
    denominations,
    formatAmount,
    getValidationRegex,
} from "./utils/denomination";
import { isInvoice, isLnurl } from "./utils/invoice";
import { validateOnchainAddress } from "./utils/validation";
import { enableWebln } from "./utils/webln";

const Create = () => {
    let invoiceInputRef, receiveAmountRef, sendAmountRef, addressInputRef;

    onMount(() => {
        sendAmountRef.focus();
    });

    createEffect(() => {
        if (sendAmountValid()) {
            validateAddress();
        }
    });

    createEffect(
        on([boltzFee, minerFee, reverse, asset], () => {
            if (amountChanged() === sideReceive) {
                setSendAmount(BigInt(calculateSendAmount(receiveAmount())));
            } else {
                setReceiveAmount(BigInt(calculateReceiveAmount(sendAmount())));
            }
            validateAmount();
        }),
    );

    createEffect(() => {
        if (assetSelect()) {
            return;
        }

        const ref =
            assetSelected() === sideSend ? sendAmountRef : receiveAmountRef;
        ref.focus();
    });

    createMemo(() => {
        const rAmount = Number(receiveAmount());
        if (rAmount > 0) {
            setReceiveAmountFormatted(formatAmount(rAmount).toString());
        }
        const sAmount = Number(sendAmount());
        if (sAmount > 0) {
            setSendAmountFormatted(formatAmount(sAmount).toString());
        }
    });

    // validation swap
    createMemo(() => {
        if (sendAmountValid()) {
            if (
                (reverse() && addressValid()) ||
                (!reverse() &&
                    invoiceValid() &&
                    (asset() !== RBTC || addressValid()))
            ) {
                setValid(true);
                return;
            }
        }
        setValid(false);
    });

    const resetInvoice = (input) => {
        if (isInvoice(invoice())) {
            setInvoice("");
            setInvoiceValid(false);
            input.setCustomValidity("");
            input.classList.remove("invalid");
        }
    };

    const changeReceiveAmount = (e) => {
        const amount = e.currentTarget.value.trim();
        const satAmount = convertAmount(Number(amount), denominations.sat);
        const sendAmount = calculateSendAmount(satAmount);
        setAmountChanged(sideReceive);
        setReceiveAmount(BigInt(satAmount));
        setSendAmount(sendAmount);
        validateAmount();
        resetInvoice(e.currentTarget);
    };

    const changeSendAmount = (e) => {
        const amount = e.currentTarget.value.trim();
        const satAmount = convertAmount(Number(amount), denominations.sat);
        const receiveAmount = calculateReceiveAmount(satAmount);
        setAmountChanged(sideSend);
        setSendAmount(BigInt(satAmount));
        setReceiveAmount(BigInt(receiveAmount));
        validateAmount();
        resetInvoice(e.currentTarget);
    };

    const createWeblnInvoice = async () => {
        enableWebln(async () => {
            const amount = Number(receiveAmount());
            const invoice = await window.webln.makeInvoice({ amount: amount });
            validateAmount();
            log.debug("created webln invoice", invoice);
            setInvoice(invoice.paymentRequest);
            validateAddress();
        });
    };

    const validateInput = (evt) => {
        const theEvent = evt || window.event;
        const input = evt.currentTarget;
        let keycode = theEvent.keyCode || theEvent.which;
        keycode = String.fromCharCode(keycode);
        const hasDot = input.value.includes(".");
        const regex = denomination() == "sat" || hasDot ? /[0-9]/ : /[0-9]|\./;
        if (!regex.test(keycode)) {
            theEvent.returnValue = false;
            if (theEvent.preventDefault) theEvent.preventDefault();
        }
    };

    const validatePaste = (evt) => {
        const clipboardData = evt.clipboardData || globalThis.clipboardData;
        const pastedData = clipboardData.getData("Text").trim();
        if (!getValidationRegex().test(pastedData)) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };

    const validateAmount = () => {
        const setCustomValidity = (val, isZero) => {
            [sendAmountRef, receiveAmountRef].forEach((ref) => {
                ref.setCustomValidity(val);
                if (!isZero && val !== "") {
                    ref.classList.add("invalid");
                } else {
                    ref.classList.remove("invalid");
                }
            });
        };

        setCustomValidity("");

        const amount = Number(sendAmount());
        const lessThanMin = amount < minimum();

        if (lessThanMin || amount > maximum()) {
            const errorMsg = t(
                lessThanMin ? "minimum_amount" : "maximum_amount",
                {
                    amount: formatAmount(lessThanMin ? minimum() : maximum()),
                    denomination: denomination(),
                },
            );
            setCustomValidity(errorMsg, amount === 0);
            setButtonLabel(errorMsg);
            setSendAmountValid(false);
            return;
        }
        setSendAmountValid(true);
    };

    const invalidateAddress = (input, msg, setSignal) => {
        setSignal(false);
        input.setCustomValidity(msg);
        setButtonLabel(msg);
        input.classList.add("invalid");
    };

    // <<<<<<< HEAD
    //     const validateAddress = (input) => {
    //         if (reverse()) {
    //             return;
    //         }

    //         let inputValue = input.value.trim();

    //         inputValue = trimLightningPrefix(inputValue);

    //         const isInputInvoice = isInvoice(inputValue);
    //         if (isLnurl(inputValue) || isInputInvoice) {
    //             // set receive/send when invoice differs from the amounts
    //             // and the input is an invoice
    //             if (isInputInvoice && !checkInvoiceAmount(inputValue)) {
    //                 try {
    //                     const decoded = decodeInvoice(inputValue);
    //                     if (decoded.satoshis === null) {
    //                         setInvoiceValid(false);
    //                         input.setCustomValidity(
    //                             "0 amount invoices are not allowed",
    //                         );
    //                         input.classList.add("invalid");
    //                         return;
    //                     }
    //                     setReceiveAmount(decoded.satoshis);
    //                     setSendAmount(calculateSendAmount(decoded.satoshis));
    //                     validateAmount();
    //                 } catch (e) {
    //                     setInvoiceValid(false);
    //                     input.setCustomValidity(e);
    //                     input.classList.add("invalid");
    //                     return;
    //                 }
    // =======
    const validateAddress = () => {
        if (reverse()) {
            return;
            // const input = addressInputRef;
            // const inputValue = input.value.trim();
            // try {
            //     setOnchainAddress(validateOnchainAddress(inputValue, asset()));
            //     setAddressValid(true);
            //     input.setCustomValidity("");
            //     input.classList.remove("invalid");
            // } catch (e) {
            //     invalidateAddress(
            //         input,
            //         "Invalid onchain address",
            //         setAddressValid,
            //     );
            // }
        } else {
            const input = invoiceInputRef;
            const inputValue = input.value.trim();
            try {
                if (isLnurl(inputValue)) {
                    setButtonLabel(t("fetch_lnurl"));
                    setLnurl(inputValue);
                    setInvoice("");
                } else {
                    const sats = validateInvoice(inputValue);
                    setReceiveAmount(sats);
                    setSendAmount(calculateSendAmount(sats));
                    validateAmount();
                    setInvoice(inputValue);
                    setLnurl(false);
                }
                setInvoiceValid(true);
                input.setCustomValidity("");
                input.classList.remove("invalid");
            } catch (e) {
                invalidateAddress(input, e.message, setInvoiceValid);
            }

            input.setCustomValidity("");
            input.classList.remove("invalid");
            setInvoiceValid(true);
            setInvoice(inputValue);
        }
    };

    const setAmount = (amount) => {
        setSendAmount(amount);
        setReceiveAmount(calculateReceiveAmount(amount));
        validateAmount();

        resetInvoice();
        sendAmountRef.focus();
    };

    return (
        <div class="frame" data-reverse={reverse()} data-asset={asset()}>
            <h2>{t("create_swap")}</h2>
            <p>
                {t("create_swap_subline")} <br />
                {t("send")}{" "}
                <ClickableAmount
                    label={t("min")}
                    onClick={setAmount}
                    amount={minimum}
                />{" "}
                <ClickableAmount
                    label={t("max")}
                    onClick={setAmount}
                    amount={maximum}
                />
            </p>
            <div class="icons">
                <div>
                    <Asset side={sideSend} signal={assetSend} />
                    <input
                        ref={sendAmountRef}
                        autofocus
                        required
                        type="text"
                        maxlength={calculateDigits()}
                        inputmode={
                            denomination() == "btc" ? "decimal" : "numeric"
                        }
                        id="sendAmount"
                        data-testid="sendAmount"
                        value={sendAmountFormatted()}
                        onpaste={(e) => validatePaste(e)}
                        onKeypress={(e) => validateInput(e)}
                        onInput={(e) => changeSendAmount(e)}
                    />
                </div>
                <Reverse />
                <div>
                    <Asset side={sideReceive} signal={assetReceive} />
                    <input
                        ref={receiveAmountRef}
                        required
                        type="text"
                        maxlength={calculateDigits()}
                        inputmode={
                            denomination() == "btc" ? "decimal" : "numeric"
                        }
                        id="receiveAmount"
                        data-testid="receiveAmount"
                        value={receiveAmountFormatted()}
                        onpaste={(e) => validatePaste(e)}
                        onKeypress={(e) => validateInput(e)}
                        onInput={(e) => changeReceiveAmount(e)}
                    />
                </div>
            </div>
            <Fees />
            <hr />
            <Show when={asset() === RBTC}>
                <ConnectMetamask
                    showAddress={true}
                    setAddressValid={setAddressValid}
                />
                <hr />
            </Show>
            <Show when={reverse() && asset() !== RBTC}>
                <AddressInput setAddressValid={setAddressValid} />
                <hr />
            </Show>
            <Show when={!reverse()}>
                <Show when={webln()}>
                    <button
                        id="webln"
                        class="btn btn-light"
                        onClick={() => createWeblnInvoice()}>
                        {t("create_invoice_webln")}
                    </button>
                    <hr />
                </Show>
                <textarea
                    required
                    ref={invoiceInputRef}
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
                <hr />
            </Show>
            <hr />
            <CreateButton validateAddress={validateAddress} />
            <AssetSelect />
        </div>
    );
};

export default Create;
