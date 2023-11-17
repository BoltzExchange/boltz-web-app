import { useNavigate } from "@solidjs/router";
import { crypto } from "bitcoinjs-lib";
import { randomBytes } from "crypto";
import log from "loglevel";
import {
    Show,
    createEffect,
    createMemo,
    createSignal,
    on,
    onMount,
} from "solid-js";

import AddressInput from "./components/AddressInput";
import Asset from "./components/Asset";
import AssetSelect from "./components/AssetSelect";
import ClickableAmount from "./components/ClickableAmount";
import ConnectMetamask from "./components/ConnectMetamask";
import Fees from "./components/Fees";
import Reverse from "./components/Reverse";
import { RBTC, sideReceive, sideSend } from "./consts";
import { ECPair } from "./ecpair/ecpair";
import { feeCheck, fetchPairs, fetcher } from "./helper";
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
    config,
    denomination,
    invoice,
    invoiceValid,
    maximum,
    minerFee,
    minimum,
    onchainAddress,
    online,
    receiveAmount,
    receiveAmountFormatted,
    reverse,
    sendAmount,
    sendAmountFormatted,
    setAddressValid,
    setAmountChanged,
    setInvoice,
    setInvoiceValid,
    setNotification,
    setNotificationType,
    setOnchainAddress,
    setReceiveAmount,
    setReceiveAmountFormatted,
    setSendAmount,
    setSendAmountFormatted,
    setSwaps,
    setValid,
    swaps,
    valid,
    wasmSupported,
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
import {
    fetchLnurl,
    isInvoice,
    isLnurl,
    trimLightningPrefix,
} from "./utils/invoice";
import { decodeInvoice, validateResponse } from "./utils/validation";
import { enableWebln } from "./utils/webln";

const Create = () => {
    let invoiceInputRef, receiveAmountRef, sendAmountRef, addressInputRef;

    onMount(() => {
        sendAmountRef.focus();
    });

    const [buttonDisable, setButtonDisable] = createSignal(true);
    const [sendAmountValid, setSendAmountValid] = createSignal(true);

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

    createMemo(() => {
        setButtonDisable(!valid());
    });

    const navigate = useNavigate();

    const resetInvoice = () => {
        if (isInvoice(invoice())) {
            setInvoice("");
            setInvoiceValid(false);
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
        resetInvoice();
    };

    const changeSendAmount = (e) => {
        const amount = e.currentTarget.value.trim();
        const satAmount = convertAmount(Number(amount), denominations.sat);
        const receiveAmount = calculateReceiveAmount(satAmount);
        setAmountChanged(sideSend);
        setSendAmount(BigInt(satAmount));
        setReceiveAmount(BigInt(receiveAmount));
        validateAmount();
        resetInvoice();
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
        const isRsk = assetName === RBTC;

        const keyPair = !isRsk ? ECPair.makeRandom() : null;

        let params = null;
        let preimage = null;

        if (reverse()) {
            preimage = randomBytes(32);
            const preimageHash = crypto.sha256(preimage).toString("hex");

            params = {
                type: "reversesubmarine",
                pairId: assetName + "/BTC",
                orderSide: "buy",
                invoiceAmount: Number(sendAmount()),
                preimageHash: preimageHash,
            };

            if (isRsk) {
                params.claimAddress = onchainAddress();
            } else {
                params.claimPublicKey = keyPair.publicKey.toString("hex");
            }
        } else {
            if (isLnurl(invoice())) {
                setInvoice(
                    await fetchLnurl(invoice(), Number(receiveAmount())),
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
                invoice: invoice(),
            };

            if (!isRsk) {
                params.refundPublicKey = keyPair.publicKey.toString("hex");
            }
        }

        if (!(await feeCheck(t("feecheck")))) {
            return;
        }

        params.pairHash = config()[`${assetName}/BTC`]["hash"];

        await new Promise((resolve) => {
            fetcher(
                "/createswap",
                (data) => {
                    data.date = new Date().getTime();
                    data.reverse = reverse();
                    data.asset = asset();
                    data.receiveAmount = Number(receiveAmount());
                    data.sendAmount = Number(sendAmount());
                    data.onchainAddress = onchainAddress();

                    if (keyPair !== null) {
                        data.privateKey = keyPair.privateKey.toString("hex");
                    }

                    if (preimage !== null) {
                        data.preimage = preimage.toString("hex");
                    }

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
                },
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
            setCustomValidity(
                t(lessThanMin ? "minimum_amount" : "maximum_amount", {
                    amount: formatAmount(lessThanMin ? minimum() : maximum()),
                    denomination: denomination(),
                }),
                amount === 0,
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
        if (reverse()) {
            return;
        }

        let inputValue = input.value.trim();

        inputValue = trimLightningPrefix(inputValue);

        const isInputInvoice = isInvoice(inputValue);
        if (isLnurl(inputValue) || isInputInvoice) {
            // set receive/send when invoice differs from the amounts
            // and the input is an invoice
            if (isInputInvoice && !checkInvoiceAmount(inputValue)) {
                try {
                    const decoded = decodeInvoice(inputValue);
                    if (decoded.satoshis === null) {
                        setInvoiceValid(false);
                        input.setCustomValidity(
                            "0 amount invoices are not allowed",
                        );
                        input.classList.add("invalid");
                        return;
                    }
                    setReceiveAmount(decoded.satoshis);
                    setSendAmount(calculateSendAmount(decoded.satoshis));
                    validateAmount();
                } catch (e) {
                    setInvoiceValid(false);
                    input.setCustomValidity(e);
                    input.classList.add("invalid");
                    return;
                }
            }

            input.setCustomValidity("");
            input.classList.remove("invalid");
            setInvoiceValid(true);
            setInvoice(inputValue);
        } else {
            setInvoiceValid(false);
            input.setCustomValidity("invalid network");
            input.classList.add("invalid");
        }
    };

    const setAmount = (amount) => {
        setSendAmount(amount);
        setReceiveAmount(calculateReceiveAmount(amount));
        validateAmount();

        resetInvoice();
        sendAmountRef.focus();
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
                {t("send")}
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
            <hr />
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
