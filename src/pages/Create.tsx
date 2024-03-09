import { BigNumber } from "bignumber.js";
import { Show, createEffect, createMemo, on, onMount } from "solid-js";

import AddressInput from "../components/AddressInput";
import Asset from "../components/Asset";
import AssetSelect from "../components/AssetSelect";
import ConnectMetamask from "../components/ConnectMetamask";
import { CreateButton, setButtonLabel } from "../components/CreateButton";
import Fees from "../components/Fees";
import InvoiceInput from "../components/InvoiceInput";
import QrScan from "../components/QrScan";
import Reverse from "../components/Reverse";
import WeblnButton from "../components/WeblnButton";
import { RBTC, sideReceive, sideSend } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import {
    calculateReceiveAmount,
    calculateSendAmount,
} from "../utils/calculate";
import {
    calculateDigits,
    convertAmount,
    denominations,
    formatAmount,
    getValidationRegex,
} from "../utils/denomination";
import { isMobile } from "../utils/helper";
import ErrorWasm from "./ErrorWasm";

const Create = () => {
    let receiveAmountRef: HTMLInputElement | undefined = undefined;
    let sendAmountRef: HTMLInputElement | undefined = undefined;

    const { setDenomination, denomination, wasmSupported, webln, t, notify } =
        useGlobalContext();
    const {
        reverse,
        asset,
        assetSend,
        assetReceive,
        assetSelect,
        assetSelected,
        invoiceValid,
        addressValid,
        amountValid,
        sendAmount,
        setSendAmount,
        receiveAmount,
        setReceiveAmount,
        sendAmountFormatted,
        setSendAmountFormatted,
        receiveAmountFormatted,
        setReceiveAmountFormatted,
        amountChanged,
        setAmountChanged,
        minimum,
        maximum,
        setValid,
        setAmountValid,
        boltzFee,
        minerFee,
    } = useCreateContext();

    // if btc and amount > 10, switch to sat
    // user failed to notice the non satoshi denomination
    const changeDenomination = (amount: string) => {
        if (amount === "") return;
        if (denomination() === denominations.btc && Number(amount) >= 10) {
            setDenomination(denominations.sat);
        } else if (denomination() === denominations.sat && Number(amount) < 1) {
            setDenomination(denominations.btc);
        }
    };

    const checkEmptyAmount = (amount: string) => {
        if (amount === "") {
            setReceiveAmount(BigNumber(0));
            setSendAmount(BigNumber(0));
        }
    };

    const changeReceiveAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value.trim().replaceAll(" ", "");
        checkEmptyAmount(amount);
        changeDenomination(amount);
        const satAmount = convertAmount(BigNumber(amount), denomination());
        const sendAmount = calculateSendAmount(
            satAmount,
            boltzFee(),
            minerFee(),
            reverse(),
        );
        setAmountChanged(sideReceive);
        setReceiveAmount(satAmount);
        setSendAmount(sendAmount);
        validateAmount();
    };

    const changeSendAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value.trim().replaceAll(" ", "");
        checkEmptyAmount(amount);
        changeDenomination(amount);
        const satAmount = convertAmount(BigNumber(amount), denomination());
        const receiveAmount = calculateReceiveAmount(
            satAmount,
            boltzFee(),
            minerFee(),
            reverse(),
        );
        setAmountChanged(sideSend);
        setSendAmount(satAmount);
        setReceiveAmount(receiveAmount);
        validateAmount();
    };

    const validateInput = (evt: KeyboardEvent) => {
        const input = evt.currentTarget as HTMLInputElement;
        const keycode = evt.key;
        // switch to sat denomination if keypress .
        if (denomination() == "sat" && keycode === ".") {
            setDenomination(denominations.btc);
        }
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
        if (!getValidationRegex(maximum()).test(pastedData)) {
            evt.stopPropagation();
            evt.preventDefault();
            notify("error", t("paste_invalid"));
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
                amount: formatAmount(
                    BigNumber(lessThanMin ? minimum() : maximum()),
                    denomination(),
                ),
                denomination: denomination(),
            };
            const label = lessThanMin ? "minimum_amount" : "maximum_amount";
            const errorMsg = t(label, params);
            setCustomValidity(errorMsg, amount === 0);
            setButtonLabel({ key: label, params: params });
            setAmountValid(false);
            return;
        }
        setAmountValid(true);
    };

    const setAmount = (amount: number) => {
        setSendAmount(BigNumber(amount));
        setReceiveAmount(
            calculateReceiveAmount(
                BigNumber(amount),
                boltzFee(),
                minerFee(),
                reverse(),
            ),
        );
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
                    calculateSendAmount(
                        receiveAmount(),
                        boltzFee(),
                        minerFee(),
                        reverse(),
                    ),
                );
            } else {
                setReceiveAmount(
                    calculateReceiveAmount(
                        sendAmount(),
                        boltzFee(),
                        minerFee(),
                        reverse(),
                    ),
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
            setReceiveAmountFormatted(
                formatAmount(BigNumber(rAmount), denomination()).toString(),
            );
        } else {
            setReceiveAmountFormatted("");
        }
        const sAmount = Number(sendAmount());
        if (sAmount > 0) {
            setSendAmountFormatted(
                formatAmount(BigNumber(sAmount), denomination()).toString(),
            );
        } else {
            setSendAmountFormatted("");
        }
    });

    // validation swap
    createMemo(() => {
        if (amountValid()) {
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
    createEffect(() => {
        if (invoiceValid()) {
            validateAmount();
        }
    });
    createEffect(() => {
        if (addressValid()) {
            validateAmount();
        }
    });

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div class="frame" data-reverse={reverse()} data-asset={asset()}>
                <h2>{t("create_swap")}</h2>
                <p>
                    {t("create_swap_subline")} <br />
                    {t("send")} {t("min")}:{" "}
                    <span
                        onClick={() => setAmount(minimum())}
                        class="btn-small btn-light">
                        {formatAmount(BigNumber(minimum()), denomination())}
                    </span>{" "}
                    {t("max")}:{" "}
                    <span
                        onClick={() => setAmount(maximum())}
                        class="btn-small btn-light">
                        {formatAmount(BigNumber(maximum()), denomination())}
                    </span>{" "}
                </p>
                <div class="icons">
                    <div>
                        <Asset side={sideSend} signal={assetSend} />
                        <input
                            ref={sendAmountRef}
                            autofocus
                            required
                            type="text"
                            placeholder="0"
                            maxlength={calculateDigits(
                                maximum(),
                                denomination(),
                            )}
                            inputmode={
                                denomination() == "btc" ? "decimal" : "numeric"
                            }
                            id="sendAmount"
                            data-testid="sendAmount"
                            value={sendAmountFormatted()}
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
                            placeholder="0"
                            maxlength={calculateDigits(
                                maximum(),
                                denomination(),
                            )}
                            inputmode={
                                denomination() == "btc" ? "decimal" : "numeric"
                            }
                            id="receiveAmount"
                            data-testid="receiveAmount"
                            value={receiveAmountFormatted()}
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
                        <WeblnButton />
                        <hr class="spacer" />
                    </Show>
                    <InvoiceInput />
                </Show>
                <Show when={isMobile}>
                    <QrScan />
                </Show>
                <CreateButton />
                <AssetSelect />
            </div>
        </Show>
    );
};

export default Create;
