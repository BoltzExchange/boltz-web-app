import log from "loglevel";
import { BigNumber } from "bignumber.js";
import * as secp from "@noble/secp256k1";
import { ECPair } from "./ecpair/ecpair";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { fetcher, fetchPairs } from "./helper";
import { fetchLnurl, isInvoice, isLnurl } from "./utils/invoice";
import { getAddress, getNetwork } from "./compat";
import Asset from "./components/Asset";
import AssetSelect from "./components/AssetSelect";
import Fees from "./components/Fees";
import arrow_svg from "./assets/arrow.svg";
import {
    convertAmount,
    denominations,
    formatAmount,
} from "./utils/denomination";
import {
    online,
    swaps,
    setSwaps,
    asset,
    denomination,
    boltzFee,
    setBoltzFee,
    sendAmount,
    setSendAmount,
    sendAmountFormatted,
    setSendAmountFormatted,
    receiveAmount,
    setReceiveAmount,
    receiveAmountFormatted,
    setReceiveAmountFormatted,
    minerFee,
    setMinerFee,
    minimum,
    setMinimum,
    maximum,
    setMaximum,
    reverse,
    setReverse,
    config,
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
    let invoiceInputRef, receiveAmountRef;

    const [firstLoad, setFirstLoad] = createSignal(true);

    // set fees and pairs
    createEffect(() => {
        let cfg = config()["BTC/BTC"];
        if (asset() === "L-BTC") {
            cfg = config()["L-BTC/BTC"];
        }
        if (cfg) {
            setMinimum(cfg.limits.minimal);
            setMaximum(cfg.limits.maximal);
            // TODO issue do not touch amounts when flipping assets
            if (reverse()) {
                let rev = cfg.fees.minerFees.baseAsset.reverse;
                let fee = rev.claim + rev.lockup;
                setBoltzFee(cfg.fees.percentage);
                setMinerFee(fee);
            } else {
                let fee = cfg.fees.minerFees.baseAsset.normal;
                setBoltzFee(cfg.fees.percentageSwapIn);
                setMinerFee(fee);
            }
            if (firstLoad() && sendAmount() === BigInt(0)) {
                setFirstLoad(false);
                setReceiveAmount(BigInt(cfg.limits.minimal));
                setSendAmount(BigInt(calculateSendAmount(cfg.limits.minimal)));
            }
        }
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
        if ((!reverse() && invoiceValid()) || (reverse() && addressValid())) {
            if (receiveAmount() >= BigInt(minimum())) {
                if (receiveAmount() <= BigInt(maximum())) {
                    setValid(true);
                    return;
                }
            }
        }
        setValid(false);
    });

    const [t] = useI18n();

    const navigate = useNavigate();

    const calculateReceiveAmount = (sendAmount) => {
        const preMinerFee = BigNumber(sendAmount).minus(minerFee());
        const receiveAmount = preMinerFee.minus(
            preMinerFee.times(boltzFee()).div(100)
        );
        return Math.floor(receiveAmount.toNumber());
    };

    const calculateSendAmount = (receiveAmount) => {
        return Math.floor(
            BigNumber(receiveAmount)
                .plus(minerFee())
                .plus(BigNumber(receiveAmount).times(boltzFee()).div(100))
                .toNumber()
        );
    };

    const changeReceiveAmount = (e) => {
        const amount = e.currentTarget.value;
        let satAmount = convertAmount(Number(amount), denominations.sat);
        let sendAmount = calculateSendAmount(satAmount);
        setReceiveAmount(BigInt(satAmount));
        setSendAmount(sendAmount);
        validateReceiveAmount(e.currentTarget);
        if (isInvoice(invoice())) setInvoice("");
    };

    const changeSendAmount = (e) => {
        const amount = e.currentTarget.value;
        let satAmount = convertAmount(Number(amount), denominations.sat);
        let receiveAmount = calculateReceiveAmount(satAmount);
        setSendAmount(BigInt(satAmount));
        setReceiveAmount(BigInt(receiveAmount));
        validateReceiveAmount(receiveAmountRef);
        if (isInvoice(invoice())) setInvoice("");
    };

    const createWeblnInvoice = async () => {
        let check_enable = await window.webln.enable();
        if (check_enable.enabled) {
            let amount = Number(receiveAmount());
            const invoice = await window.webln.makeInvoice({ amount: amount });
            log.debug("created webln invoice", invoice);
            setInvoice(invoice.paymentRequest);
            validateAddress(invoiceInputRef);
        }
    };

    const create = async () => {
        if (!valid()) return;

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
            let preimageHash = await secp.utils.sha256(preimage);
            let preimageHashHex = secp.utils.bytesToHex(preimageHash);
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
            if (!isInvoice(invoice())) {
                const msg = "invalid network";
                log.error(msg);
                setNotificationType("error");
                setNotification(msg);
                return false;
            }

            params = {
                type: "submarine",
                pairId: asset_name + "/BTC",
                orderSide: "sell",
                refundPublicKey: publicKeyHex,
                invoice: invoice(),
            };
        }
        fetcher(
            "/createswap",
            (data) => {
                data.privateKey = privateKeyHex;
                data.date = new Date().getTime();
                data.reverse = reverse();
                data.asset = asset();
                data.preimage = preimageHex;
                data.receiveAmount = Number(receiveAmount());
                data.onchainAddress = onchainAddress();
                let tmp_swaps = JSON.parse(swaps());
                tmp_swaps.push(data);
                setSwaps(JSON.stringify(tmp_swaps));
                setInvoice("");
                setOnchainAddress("");
                navigate("/swap/" + data.id);
            },
            params
        );
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

    const validateReceiveAmount = (input) => {
        input.setCustomValidity("");
        const amount = convertAmount(Number(input.value), denominations.sat);
        if (amount < minimum()) {
            input.setCustomValidity(
                t("minimum_amount", {
                    amount: formatAmount(minimum()),
                    denomination: denomination(),
                })
            );
        }
        if (amount > maximum()) {
            input.setCustomValidity(
                t("maximum_amount", {
                    amount: formatAmount(maximum()),
                    denomination: denomination(),
                })
            );
        }
    };

    const validateAddress = (input) => {
        const inputValue = input.value;
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
            if (isInvoice(inputValue) || isLnurl(inputValue)) {
                input.setCustomValidity("");
                setInvoiceValid(true);
                setInvoice(inputValue);
            } else {
                setInvoiceValid(false);
                input.setCustomValidity("invalid network");
            }
        }
    };

    let timer = setInterval(() => {
        log.debug("tick Create");
        fetchPairs();
    }, 30000);

    onCleanup(() => {
        log.debug("cleanup Create");
        clearInterval(timer);
    });

    fetchPairs();

    return (
        <div class="frame" data-reverse={reverse()} data-asset={asset()}>
            <h2>{t("create_swap")}</h2>
            <p>
                {t("create_swap_subline")} <br />
                {t("min")}: {formatAmount(minimum())}, {t("max")}:{" "}
                {formatAmount(maximum())}
            </p>
            <hr />
            <div class="icons">
                <div>
                    <Asset id="1" />
                    <input
                        required
                        type="text"
                        maxlength={denomination() == "btc" ? "10" : "7"}
                        pattern="0\.[0-9]{1,8}|[0-9]{1,10}"
                        inputmode={
                            denomination() == "btc" ? "decimal" : "numeric"
                        }
                        id="sendAmount"
                        step={denomination() == "btc" ? 0.00000001 : 1}
                        value={sendAmountFormatted()}
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
                        autofocus
                        required
                        type="text"
                        pattern="0\.[0-9]{1,8}|[0-9]{1,10}"
                        maxlength={denomination() == "btc" ? "10" : "7"}
                        inputmode={
                            denomination() == "btc" ? "decimal" : "numeric"
                        }
                        id="receiveAmount"
                        step={denomination() == "btc" ? 0.00000001 : 1}
                        value={receiveAmountFormatted()}
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
                    disabled={valid() ? "" : "disabled"}
                    onClick={create}>
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
