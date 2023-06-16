import log from "loglevel";
import { createMemo, createSignal, createEffect } from "solid-js";
import * as secp from "@noble/secp256k1";
import { ECPair } from "./ecpair/ecpair";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import Fees from "./components/Fees";
import Asset from "./components/Asset";
import arrow_svg from "./assets/arrow.svg";
import { getAddress, getNetwork } from "./compat";
import AssetSelect from "./components/AssetSelect";
import { decodeInvoice, validateResponse } from "./utils/validation";
import { errorHandler, fetcher, fetchPairs, feeCheck } from "./helper";
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
} from "./signals";

const Create = () => {
    let invoiceInputRef, receiveAmountRef, sendAmountRef, addressInputRef;

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
        } else {
            if (reverse()) {
                setReceiveAmount(BigInt(calculateReceiveAmount(sendAmount())));
            } else {
                setSendAmount(BigInt(calculateSendAmount(receiveAmount())));
            }
            validateAmount();
        }
    });

    createEffect(() => {
        reverse();
        validateAmount();
    });

    // change denomination
    createMemo(() => {
        setReceiveAmountFormatted(
            formatAmount(Number(receiveAmount())).toString()
        );
        setSendAmountFormatted(formatAmount(Number(sendAmount())).toString());
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
        let satAmount = convertAmount(Number(amount), denominations.sat);
        let sendAmount = calculateSendAmount(satAmount);
        setReceiveAmount(BigInt(satAmount));
        setSendAmount(sendAmount);
        validateAmount();
        checkInvoice();
    };

    const changeSendAmount = (e) => {
        const amount = e.currentTarget.value.trim();
        let satAmount = convertAmount(Number(amount), denominations.sat);
        let receiveAmount = calculateReceiveAmount(satAmount);
        setSendAmount(BigInt(satAmount));
        setReceiveAmount(BigInt(receiveAmount));
        validateAmount();
        checkInvoice();
    };

    const createWeblnInvoice = async () => {
        let check_enable = await window.webln.enable();
        if (check_enable.enabled) {
            let amount = Number(receiveAmount());
            const invoice = await window.webln.makeInvoice({ amount: amount });
            validateAmount();
            log.debug("created webln invoice", invoice);
            setInvoice(invoice.paymentRequest);
            validateAddress(invoiceInputRef);
        }
    };

    const create = async () => {
        if (!valid()) return;
        if (!(await feeCheck(t("feecheck")))) return;

        let asset_name = asset();

        const address = getAddress(asset_name);
        const net = getNetwork(asset_name);

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
                pairId: asset_name + "/BTC",
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
                pairId: asset_name + "/BTC",
                orderSide: "sell",
                refundPublicKey: publicKeyHex,
                invoice: invoice(),
            };
        }
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
                (err) => {
                    resolve();
                    errorHandler(err);
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
                <span
                    class="denominator"
                    data-denominator={denomination()}></span>
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
                        onKeypress={(e) => validateInput(e)}
                        onInput={(e) => changeSendAmount(e)}
                    />
                </div>
                <div
                    id="flip-assets"
                    onClick={() => {
                        setReverse(!reverse());
                        setSendAmount(
                            BigInt(calculateSendAmount(Number(receiveAmount())))
                        );
                    }}>
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
                    amount: receiveAmount().toString(),
                    denomination: "sat",
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
                            .catch(() => setButtonDisable(false));
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
