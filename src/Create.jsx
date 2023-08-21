import log from "loglevel";
import { createMemo, createSignal, createEffect, on, onMount } from "solid-js";
import * as secp from "@noble/secp256k1";
import { ECPair } from "./ecpair/ecpair";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import Fees from "./components/Fees";
import Asset from "./components/Asset";
import arrow_svg from "./assets/arrow.svg";
import { enableWebln } from "./utils/webln";
import { getAddress, getNetwork } from "./compat";
import AssetSelect from "./components/AssetSelect";
import { decodeInvoice, validateResponse } from "./utils/validation";
import { fetcher, fetchPairs, feeCheck } from "./helper";
import {
    fetchLnurl,
    isInvoice,
    isLnurl,
    trimLightningPrefix,
} from "./utils/invoice";
import { calculateReceiveAmount, calculateSendAmount } from "./utils/calculate";
import {
    convertAmount,
    denominations,
    formatAmount,
    calculateDigits,
    getValidationRegex,
} from "./utils/denomination";
import {
    online,
    swaps,
    setSwaps,
    asset,
    denomination,
    sendAmount,
    setSendAmount,
    sendAmountFormatted,
    setSendAmountFormatted,
    receiveAmount,
    setReceiveAmount,
    receiveAmountFormatted,
    setReceiveAmountFormatted,
    minimum,
    maximum,
    reverse,
    setReverse,
    valid,
    setValid,
    invoiceValid,
    setInvoiceValid,
    addressValid,
    setAddressValid,
    invoice,
    setInvoice,
    onchainAddress,
    setOnchainAddress,
    setNotification,
    setNotificationType,
    webln,
    wasmSupported,
    config,
    boltzFee,
    minerFee,
} from "./signals";

const Create = () => {
    let invoiceInputRef, receiveAmountRef, sendAmountRef, addressInputRef;

    onMount(() => {
        sendAmountRef.focus();
    });

    const [firstLoad, setFirstLoad] = createSignal(true);
    const [buttonDisable, setButtonDisable] = createSignal(true);
    const [sendAmountValid, setSendAmountValid] = createSignal(true);

    createEffect(() => {
        if (minimum() === 0) {
            return;
        }

        if (firstLoad() && sendAmount() === BigInt(0)) {
            setFirstLoad(false);
            setSendAmount(BigInt(minimum()));
            setReceiveAmount(BigInt(calculateReceiveAmount(minimum())));
        }
    });

    createEffect(
        on([boltzFee, minerFee, reverse, asset], () => {
            setReceiveAmount(BigInt(calculateReceiveAmount(sendAmount())));
            validateAmount();
        })
    );

    const changeFormatted = (ref, setSignal, signalValue) => {
        const amount = formatAmount(Number(signalValue)).toString();
        let selectionIndex = ref.selectionStart;
        const matches = amount.match(new RegExp(" ", "g"));
        if (matches) {
            selectionIndex += matches.length - 1;
        }
        setSignal(amount);
        setTimeout(() => {
            ref.setSelectionRange(selectionIndex, selectionIndex);
        }, 1);
    };

    // format receive amount
    createEffect(() => {
        changeFormatted(
            receiveAmountRef,
            setReceiveAmountFormatted,
            receiveAmount()
        );
    });

    // format send amount
    createEffect(() => {
        changeFormatted(sendAmountRef, setSendAmountFormatted, sendAmount());
    });

    // validation swap
    createMemo(() => {
        if (sendAmountValid()) {
            if (
                (reverse() && addressValid()) ||
                (!reverse() && invoiceValid())
            ) {
                setValid(true);
                return;
            }
        }

        setValid(false);
    });

    createMemo(() => {
        setButtonDisable(!valid());
    });

    const [t] = useI18n();

    const navigate = useNavigate();

    const checkInvoice = () => {
        if (isInvoice(invoice())) {
            setInvoice("");
            setInvoiceValid(false);
        }
    };

    const changeReceiveAmount = (e) => {
        const amount = e.currentTarget.value.trim();
        const satAmount = convertAmount(amount, denominations.sat);
        const sendAmount = calculateSendAmount(satAmount);
        setReceiveAmount(BigInt(satAmount));
        setSendAmount(sendAmount);
        validateAmount();
        checkInvoice();
    };

    const changeSendAmount = (e) => {
        const amount = e.currentTarget.value.trim();
        const satAmount = convertAmount(amount, denominations.sat);
        const receiveAmount = calculateReceiveAmount(satAmount);
        setSendAmount(BigInt(satAmount));
        setReceiveAmount(BigInt(receiveAmount));
        validateAmount();
        checkInvoice();
    };

    const createWeblnInvoice = async () => {
        enableWebln(async () => {
            const amount = Number(receiveAmount());
            const invoice = await window.webln.makeInvoice({ amount: amount });
            validateAmount();
            log.debug("created webln invoice", invoice);
            setInvoice(invoice.paymentRequest);
            validateAddress(invoiceInputRef);
        });
    };

    const create = async () => {
        if (!valid()) return;

        const assetName = asset();

        const address = getAddress(assetName);
        const net = getNetwork(assetName);

        const pair = ECPair.makeRandom();
        const privateKeyHex = pair.privateKey.toString("hex");
        const publicKeyHex = pair.publicKey.toString("hex");
        let params = null;
        let preimageHex = null;

        if (reverse()) {
            address.toOutputScript(onchainAddress(), net);
            const preimage = secp.utils.randomBytes(32);
            preimageHex = secp.utils.bytesToHex(preimage);
            const preimageHash = await secp.utils.sha256(preimage);
            const preimageHashHex = secp.utils.bytesToHex(preimageHash);
            params = {
                type: "reversesubmarine",
                pairId: assetName + "/BTC",
                orderSide: "buy",
                invoiceAmount: Number(sendAmount()),
                claimPublicKey: publicKeyHex,
                preimageHash: preimageHashHex,
            };
        } else {
            if (isLnurl(invoice())) {
                setInvoice(
                    await fetchLnurl(invoice(), Number(receiveAmount()))
                );
            }
            validateAddress(invoiceInputRef);
            if (!invoiceValid()) {
                const msg = "invalid invoice";
                log.error(msg);
                setNotificationType("error");
                setNotification(msg);
                return true;
            }

            params = {
                type: "submarine",
                pairId: assetName + "/BTC",
                orderSide: "sell",
                refundPublicKey: publicKeyHex,
                invoice: invoice(),
            };
        }

        params.pairHash = config()[`${assetName}/BTC`]["hash"];

        await new Promise((resolve) => {
            fetcher(
                "/createswap",
                (data) => {
                    data.privateKey = privateKeyHex;
                    data.date = new Date().getTime();
                    data.reverse = reverse();
                    data.asset = asset();
                    data.preimage = preimageHex;
                    data.receiveAmount = Number(receiveAmount());
                    data.sendAmount = Number(sendAmount());
                    data.onchainAddress = onchainAddress();

                    if (!data.reverse) {
                        data.invoice = invoice();
                    }

                    validateResponse(data).then((success) => {
                        if (!success) {
                            resolve();
                            navigate("/error/");
                            return;
                        }

                        setSwaps(swaps().concat(data));
                        setInvoice("");
                        setInvoiceValid(false);
                        setOnchainAddress("");
                        setAddressValid(false);
                        resolve();
                        navigate("/swap/" + data.id);
                    });
                },
                params,
                async (err) => {
                    const res = await err.json();
                    if (res.error === "invalid pair hash") {
                        await feeCheck(t("feecheck"));
                    } else {
                        setNotificationType("error");
                        setNotification(res.error);
                    }

                    resolve();
                }
            );
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

    const validateKeyDown = (evt) => {
        const theEvent = evt || window.event;
        const input = evt.currentTarget;
        let keycode = theEvent.keyCode || theEvent.which;
        if (keycode === 37) {
            // left arrow
            if (
                input.value[input.selectionStart - 2] === " " ||
                input.value[input.selectionStart - 2] === "."
            ) {
                input.setSelectionRange(
                    input.selectionStart - 1,
                    input.selectionStart - 1
                );
            }
        } else if (keycode === 39) {
            // right arrow
            if (
                input.value[input.selectionStart] === " " ||
                input.value[input.selectionStart] === "."
            ) {
                input.setSelectionRange(
                    input.selectionStart + 1,
                    input.selectionStart + 1
                );
            }
        } else if (keycode === 8) {
            // backspace
            if (
                input.selectionEnd - input.selectionStart === 1 &&
                input.value[input.selectionStart] === " "
            ) {
                input.setSelectionRange(
                    input.selectionStart,
                    input.selectionStart
                );
                theEvent.returnValue = false;
                if (theEvent.preventDefault) theEvent.preventDefault();
            } else if (input.value[input.selectionStart - 1] === ".") {
                input.setSelectionRange(
                    input.selectionStart - 1,
                    input.selectionStart - 1
                );
                theEvent.returnValue = false;
                if (theEvent.preventDefault) theEvent.preventDefault();
            } else if (input.value[input.selectionStart - 1] === " ") {
                const index = input.selectionStart;
                input.value =
                    input.value.substring(0, index - 2) +
                    input.value.substring(index);
                input.setSelectionRange(index - 1, index - 1);
                input.dispatchEvent(
                    new Event("input", {
                        bubbles: true,
                        cancelable: true,
                    })
                );
                theEvent.returnValue = false;
                if (theEvent.preventDefault) theEvent.preventDefault();
            }
        } else if (keycode === 46) {
            // delete
            if (
                input.selectionEnd - input.selectionStart === 1 &&
                input.value[input.selectionStart] === " "
            ) {
                input.setSelectionRange(
                    input.selectionStart + 1,
                    input.selectionStart + 1
                );
                theEvent.returnValue = false;
                if (theEvent.preventDefault) theEvent.preventDefault();
            } else if (input.value[input.selectionStart] === ".") {
                input.setSelectionRange(
                    input.selectionStart + 1,
                    input.selectionStart + 1
                );
                theEvent.returnValue = false;
                if (theEvent.preventDefault) theEvent.preventDefault();
            } else if (input.value[input.selectionStart] === " ") {
                const index = input.selectionStart;
                input.value =
                    input.value.substring(0, index) +
                    input.value.substring(index + 2);
                input.setSelectionRange(index, index);
                input.dispatchEvent(
                    new Event("input", {
                        bubbles: true,
                        cancelable: true,
                    })
                );
                theEvent.returnValue = false;
                if (theEvent.preventDefault) theEvent.preventDefault();
            }
        }
        if (
            calculateDigits() == input.value.length &&
            input.selectionStart !== input.value.length
        ) {
            const normalizedKeyCode =
                keycode >= 96 && keycode <= 105 ? keycode - 48 : keycode;
            const isDigit = normalizedKeyCode >= 48 && normalizedKeyCode <= 57;
            const digit = String.fromCharCode(normalizedKeyCode);
            if (isDigit) {
                let index = input.selectionStart;
                if (input.value[index] === " ") {
                    index++;
                }
                if (input.value[index] === ".") {
                    index++;
                }
                input.value =
                    input.value.substring(0, index) +
                    digit +
                    input.value.substring(index + 1);
                if (input.value[index + 1] === " ") {
                    index++;
                }
                if (input.value.includes(".")) {
                    index++;
                }
                input.setSelectionRange(index, index);
                input.dispatchEvent(
                    new Event("input", {
                        bubbles: true,
                        cancelable: true,
                    })
                );
            }
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
        const setCustomValidity = (val) => {
            [sendAmountRef, receiveAmountRef].forEach((ref) =>
                ref.setCustomValidity(val)
            );
        };

        setCustomValidity("");

        const amount = Number(sendAmount());
        const lessThanMin = amount < minimum();

        if (lessThanMin || amount > maximum()) {
            setCustomValidity(
                t(lessThanMin ? "minimum_amount" : "maximum_amount", {
                    amount: formatAmount(lessThanMin ? minimum() : maximum()),
                    denomination: denomination(),
                })
            );
            setSendAmountValid(false);
            return;
        }

        setSendAmountValid(true);
    };

    const checkInvoiceAmount = (invoice) => {
        try {
            return receiveAmount() === BigInt(decodeInvoice(invoice).satoshis);
        } catch (e) {
            return false;
        }
    };

    const validateAddress = (input) => {
        let inputValue = input.value.trim();
        if (reverse()) {
            try {
                // validate btc address
                const asset_name = asset();
                const address = getAddress(asset_name);
                address.toOutputScript(inputValue, getNetwork(asset_name));
                input.setCustomValidity("");
                setAddressValid(true);
                setOnchainAddress(inputValue);
            } catch (e) {
                setAddressValid(false);
                input.setCustomValidity("invalid address");
            }
        } else {
            inputValue = trimLightningPrefix(inputValue);

            if (
                isLnurl(inputValue) ||
                (isInvoice(inputValue) && checkInvoiceAmount(inputValue))
            ) {
                input.setCustomValidity("");
                setInvoiceValid(true);
                setInvoice(inputValue);
            } else {
                setInvoiceValid(false);
                input.setCustomValidity("invalid network");
            }
        }
    };

    createEffect(() => {
        if (reverse()) {
            validateAddress(addressInputRef);
        }
    });

    return (
        <div class="frame" data-reverse={reverse()} data-asset={asset()}>
            <h2>{t("create_swap")}</h2>
            <p>
                {t("create_swap_subline")} <br />
                {t("send")} {t("min")}: {formatAmount(minimum())}, {t("max")}:{" "}
                {formatAmount(maximum())}
            </p>
            <hr />
            <div class="icons">
                <div>
                    <Asset id="1" />
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
                        value={sendAmountFormatted()}
                        onpaste={(e) => validatePaste(e)}
                        onKeyDown={(e) => validateKeyDown(e)}
                        onKeypress={(e) => validateInput(e)}
                        onInput={(e) => changeSendAmount(e)}
                    />
                </div>
                <div id="flip-assets" onClick={() => setReverse(!reverse())}>
                    <img src={arrow_svg} alt="flip assets" />
                </div>
                <div>
                    <Asset id="2" />
                    <input
                        ref={receiveAmountRef}
                        required
                        type="text"
                        maxlength={calculateDigits()}
                        inputmode={
                            denomination() == "btc" ? "decimal" : "numeric"
                        }
                        id="receiveAmount"
                        value={receiveAmountFormatted()}
                        onpaste={(e) => validatePaste(e)}
                        onKeyDown={(e) => validateKeyDown(e)}
                        onKeypress={(e) => validateInput(e)}
                        onInput={(e) => changeReceiveAmount(e)}
                    />
                </div>
            </div>
            <Fees />
            <hr />
            <Show when={webln() && !reverse()}>
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
                id="invoice"
                name="invoice"
                value={invoice()}
                placeholder={t("create_and_paste", {
                    amount: receiveAmountFormatted(),
                    denomination: denomination(),
                })}></textarea>
            <input
                required
                ref={addressInputRef}
                onInput={(e) => validateAddress(e.currentTarget)}
                type="text"
                id="onchainAddress"
                name="onchainAddress"
                placeholder={t("onchain_address", { asset: asset() })}
            />
            <hr />
            <Show when={online() && wasmSupported()}>
                <button
                    id="create-swap"
                    class="btn"
                    disabled={buttonDisable() ? "disabled" : ""}
                    onClick={() => {
                        setButtonDisable(true);
                        create()
                            .then((res) => !res && setButtonDisable(false))
                            .catch((e) => {
                                log.warn("create failed", e);
                                setButtonDisable(false);
                            });
                    }}>
                    {t("create_swap")}
                </button>
            </Show>
            <Show when={!online()}>
                <button
                    id="create-swap"
                    class="btn btn-danger"
                    onClick={fetchPairs}>
                    {t("api_offline")}
                </button>
            </Show>
            <Show when={!wasmSupported()}>
                <button
                    id="create-swap"
                    class="btn btn-danger"
                    onClick={fetchPairs}>
                    {t("wasm_not_supported")}
                </button>
            </Show>
            <AssetSelect />
        </div>
    );
};

export default Create;
