import { BigNumber } from "bignumber.js";
import log from "loglevel";
import { Show, createEffect, createMemo, on, onMount } from "solid-js";

import AddressInput from "./components/AddressInput";
import Asset from "./components/Asset";
import AssetSelect from "./components/AssetSelect";
import ClickableAmount from "./components/ClickableAmount";
import ConnectMetamask from "./components/ConnectMetamask";
import { CreateButton, setButtonLabel } from "./components/CreateButton";
import Fees from "./components/Fees";
import InvoiceInput from "./components/InvoiceInput";
import QrScan from "./components/QrScan";
import Reverse from "./components/Reverse";
import { RBTC, sideReceive, sideSend } from "./consts";
import { isMobile } from "./helper";
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
    setAmountChanged,
    setInvoice,
    setReceiveAmount,
    setReceiveAmountFormatted,
    setSendAmount,
    setSendAmountFormatted,
    setSendAmountValid,
    setValid,
    wasmSupported,
    webln,
} from "./signals";
import { calculateReceiveAmount, calculateSendAmount } from "./utils/calculate";
import {
    calculateDigits,
    convertAmount,
    formatAmount,
    getValidationRegex,
} from "./utils/denomination";
import { enableWebln } from "./utils/webln";

const Create = () => {
    let receiveAmountRef: HTMLInputElement, sendAmountRef: HTMLInputElement;

    const changeReceiveAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value.trim();
        const satAmount = convertAmount(Number(amount), denomination());
        const sendAmount = calculateSendAmount(satAmount);
        setAmountChanged(sideReceive);
        setReceiveAmount(BigNumber(satAmount));
        setSendAmount(BigNumber(sendAmount));
        validateAmount();
        target.setCustomValidity("");
        target.classList.remove("invalid");
    };

    const changeSendAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value.trim();
        const satAmount = convertAmount(Number(amount), denomination());
        const receiveAmount = calculateReceiveAmount(satAmount);
        setAmountChanged(sideSend);
        setSendAmount(BigNumber(satAmount));
        setReceiveAmount(BigNumber(receiveAmount));
        validateAmount();
        target.setCustomValidity("");
        target.classList.remove("invalid");
    };

    const createWeblnInvoice = async () => {
        enableWebln(async () => {
            const amount = Number(receiveAmount());
            const invoice = await window.webln.makeInvoice({ amount: amount });
            validateAmount();
            log.debug("created webln invoice", invoice);
            setInvoice(invoice.paymentRequest);
        });
    };

    const validateInput = (evt: KeyboardEvent) => {
        const input = evt.currentTarget as HTMLInputElement;
        const keycode = evt.key;
        const hasDot = input.value.includes(".");
        const regex = denomination() == "sat" || hasDot ? /[0-9]/ : /[0-9]|\./;
        if (!regex.test(keycode)) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };

    const validatePaste = (evt: ClipboardEvent) => {
        const clipboardData = evt.clipboardData || globalThis.clipboardData;
        const pastedData = clipboardData.getData("Text").trim();
        if (!getValidationRegex().test(pastedData)) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };

    const validateAmount = () => {
        const setCustomValidity = (val: string, isZero: boolean) => {
            [sendAmountRef, receiveAmountRef].forEach((ref) => {
                ref.setCustomValidity(val);
                if (!isZero && val !== "") {
                    ref.classList.add("invalid");
                } else {
                    ref.classList.remove("invalid");
                }
            });
        };

        setCustomValidity("", false);

        const amount = Number(sendAmount());
        const lessThanMin = amount < minimum();

        if (lessThanMin || amount > maximum()) {
            const params = {
                amount: formatAmount(lessThanMin ? minimum() : maximum()),
                denomination: denomination(),
            };
            const label = lessThanMin ? "minimum_amount" : "maximum_amount";
            const errorMsg = t(label, params);
            setCustomValidity(errorMsg, amount === 0);
            setButtonLabel({ key: label, params: params });
            setSendAmountValid(false);
            return;
        }
        setSendAmountValid(true);
    };

    const setAmount = (amount: number) => {
        setSendAmount(BigNumber(amount));
        setReceiveAmount(BigNumber(calculateReceiveAmount(amount)));
        validateAmount();
        sendAmountRef.focus();
    };

    onMount(() => {
        sendAmountRef.focus();
    });

    createEffect(
        on([boltzFee, minerFee, reverse, asset], () => {
            if (amountChanged() === sideReceive) {
                setSendAmount(
                    BigNumber(calculateSendAmount(receiveAmount().toNumber())),
                );
            } else {
                setReceiveAmount(
                    BigNumber(calculateReceiveAmount(sendAmount().toNumber())),
                );
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

    // validate amounts when invoice is valid, because we
    // set the amount based on invoice amount if amount is 0
    createMemo(() => {
        if (invoiceValid()) {
            validateAmount();
        }
    });
    createMemo(() => {
        if (addressValid()) {
            validateAmount();
        }
    });

    return (
        <div class="frame" data-reverse={reverse()} data-asset={asset()}>
            <h2>{t("create_swap")}</h2>
            <p>
                {t("create_swap_subline")} <br />
                {t("send")}{" "}
                <ClickableAmount
                    label={"min"}
                    onClick={setAmount}
                    amount={minimum}
                />{" "}
                <ClickableAmount
                    label={"max"}
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
                        placeholder={formatAmount(minimum())}
                        maxlength={calculateDigits()}
                        inputmode={
                            denomination() == "btc" ? "decimal" : "numeric"
                        }
                        id="sendAmount"
                        data-testid="sendAmount"
                        value={
                            sendAmountFormatted() === 0
                                ? ""
                                : sendAmountFormatted()
                        }
                        onpaste={(e) => validatePaste(e)}
                        onkeypress={(e) => validateInput(e)}
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
                        placeholder={formatAmount(
                            calculateReceiveAmount(minimum()),
                        )}
                        maxlength={calculateDigits()}
                        inputmode={
                            denomination() == "btc" ? "decimal" : "numeric"
                        }
                        id="receiveAmount"
                        data-testid="receiveAmount"
                        value={
                            receiveAmountFormatted() === 0
                                ? ""
                                : receiveAmountFormatted()
                        }
                        onpaste={(e) => validatePaste(e)}
                        onkeypress={(e) => validateInput(e)}
                        onInput={(e) => changeReceiveAmount(e)}
                    />
                </div>
            </div>
            <Fees />
            <hr class="spacer" />
            <Show when={asset() === RBTC}>
                <ConnectMetamask showAddress={true} />
                <hr class="spacer" />
            </Show>
            <Show when={reverse() && asset() !== RBTC}>
                <AddressInput />
            </Show>
            <Show when={!reverse()}>
                <Show when={webln()}>
                    <button
                        id="webln"
                        class="btn btn-light"
                        onClick={() => createWeblnInvoice()}>
                        {t("create_invoice_webln")}
                    </button>
                    <hr class="spacer" />
                </Show>
                <InvoiceInput />
            </Show>
            <Show when={isMobile && wasmSupported()}>
                <QrScan />
            </Show>
            <CreateButton />
            <AssetSelect />
        </div>
    );
};

export default Create;
