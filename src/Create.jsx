import log from "loglevel";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, lnurl_fetcher, fetchPairs } from "./helper";
import { useNavigate } from "@solidjs/router";

import * as secp from "@noble/secp256k1";
import { ECPair } from "./ecpair/ecpair";
import { getAddress, getNetwork } from "./compat";

import Asset from "./components/Asset";
import AssetSelect from "./components/AssetSelect";
import Fees from "./components/Fees";

import arrow_svg from "./assets/arrow.svg";

import { bolt11_prefix } from "./config";
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
        setReceiveAmountFormatted(formatAmount(Number(receiveAmount())));
        setSendAmountFormatted(formatAmount(Number(sendAmount())));
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
        const preMinerFee = sendAmount - minerFee();
        sendAmount = preMinerFee - Math.floor((preMinerFee * boltzFee()) / 100);
        return Math.max(sendAmount, 0);
    };

    const calculateSendAmount = (receiveAmount) => {
        receiveAmount =
            parseInt(receiveAmount) +
            parseInt(minerFee()) +
            Math.ceil((receiveAmount * boltzFee()) / 100);
        return Math.max(Math.floor(receiveAmount), 0);
    };

    const changeReceiveAmount = (amount) => {
        let satAmount = convertAmount(Number(amount), denominations.sat);
        setReceiveAmount(BigInt(satAmount));
        setReceiveAmountFormatted(formatAmount(satAmount));
        let sendAmount = calculateSendAmount(satAmount);
        setSendAmount(sendAmount);
        setSendAmountFormatted(formatAmount(sendAmount, true));
    };

    const changeSendAmount = (amount) => {
        let satAmount = BigInt(
            convertAmount(Number(amount), denominations.sat)
        );
        setSendAmount(satAmount);
        setSendAmountFormatted(formatAmount(Number(satAmount)));
        let receiveAmount = calculateReceiveAmount(Number(satAmount));
        setReceiveAmount(receiveAmount);
        setReceiveAmountFormatted(formatAmount(Number(receiveAmount), true));
    };

    const createWeblnInvoice = async () => {
        let check_enable = await window.webln.enable();
        if (check_enable.enabled) {
            let amount = Number(receiveAmount());
            const invoice = await window.webln.makeInvoice({ amount: amount });
            log.debug("created webln invoice", invoice);
            setInvoice(invoice.paymentRequest);
        }
    };

    const create = async () => {
        if (valid()) {
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
                if (
                    invoice().indexOf("@") > 0 ||
                    invoice().indexOf("lnurl") == 0 ||
                    invoice().indexOf("LNURL") == 0
                ) {
                    let pr = await lnurl_fetcher(
                        invoice(),
                        Number(receiveAmount())
                    );
                    setInvoice(pr);
                }
                if (invoice().indexOf(bolt11_prefix) != 0) {
                    let msg = "invalid network";
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


    const validateInput = (evt) => {
        const theEvent = evt || window.event;
        let key = theEvent.keyCode || theEvent.which;
        key = String.fromCharCode(key);
        const regex = (denomination() == "sat") ? /[0-9]/ : /[0-9]|\./;
        const count = 10;
        if( !regex.test(key) || evt.currentTarget.value.length >= count) {
            theEvent.returnValue = false;
            if(theEvent.preventDefault) theEvent.preventDefault();
        }
    }

    const validateAddress = (input) => {
        const inputValue = input.value;
        if (reverse()) {
            try {
                // validate btc address
                let asset_name = asset();
                const address = getAddress(asset_name);
                const net = getNetwork(asset_name);
                address.toOutputScript(inputValue, net);
                input.setCustomValidity("");
                setAddressValid(true);
                setOnchainAddress(inputValue);
            } catch (e) {
                setAddressValid(false);
                input.setCustomValidity("invalid address");
            }
        } else {
            if (
                inputValue.indexOf("@") > 0 ||
                inputValue.indexOf("lnurl") == 0 ||
                inputValue.indexOf("LNURL") == 0 ||
                inputValue.indexOf(bolt11_prefix) == 0
            ) {
                input.setCustomValidity("");
                setInvoiceValid(true);
                setInvoice(inputValue);
            } else {
                setInvoiceValid(false);
                input.setCustomValidity("invalid network");
            }
        }
    }


    return (
        <div class="frame" data-reverse={reverse()} data-asset={asset()}>
            <h2>{t("create_swap")}</h2>
            <p>
                {t("create_swap_subline")} <br />
                Min: {formatAmount(minimum())}, Max: {formatAmount(maximum())}
            </p>
            <hr />
            <div class="icons">
                <div>
                    <Asset id="1" />
                    <input
                        required
                        type="number"
                        inputmode={denomination() == "btc" ? "decimal" : "numeric"}
                        id="sendAmount"
                        step={denomination() == "btc" ? 0.00000001 : 1}
                        value={sendAmountFormatted()}
                        onKeypress={validateInput}
                        onInput={(e) => changeSendAmount(e.currentTarget.value)}
                    />
                </div>
                <div
                    id="flip-assets"
                    onClick={() => {
                        setReverse(!reverse());
                        setSendAmount(BigInt(calculateSendAmount(Number(receiveAmount()))));
                    }}>
                    <img src={arrow_svg} alt="flip assets" />
                </div>
                <div>
                    <Asset id="2" />
                    <input
                        autofocus
                        required
                        type="number"
                        inputmode={denomination() == "btc" ? "decimal" : "numeric"}
                        id="receiveAmount"
                        step={denomination() == "btc" ? 0.00000001 : 1}
                        min={formatAmount(minimum())}
                        max={formatAmount(maximum())}
                        value={receiveAmountFormatted()}
                        onKeypress={validateInput}
                        onInput={(e) => changeReceiveAmount(e.currentTarget.value)}
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
                <button id="create-swap" class="btn" disabled={valid() ? "" : "disabled"} onClick={create}>
                    {t("create_swap")}
                </button>
            </Show>
            <Show when={!online()}>
                <button id="create-swap" class="btn btn-danger" onClick={fetchPairs}>
                    {t("api_offline")}
                </button>
            </Show>
            <Show when={!wasmSupported()}>
                <button id="create-swap" class="btn btn-danger" onClick={fetchPairs}>
                    {t("wasm_not_supported")}
                </button>
            </Show>
            <AssetSelect />
        </div>
    );
};

export default Create;
