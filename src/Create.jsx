import log from "loglevel";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, lnurl_fetcher, fetchPairs } from "./helper";
import { useNavigate } from "@solidjs/router";

import * as secp from "@noble/secp256k1";
import { ECPair } from "./ecpair/ecpair";
import { getAddress, getNetwork } from "./compat";

import AssetSelect from "./AssetSelect";

import btc_svg from "./assets/btc.svg";
import sat_svg from "./assets/sat.svg";
import reload_svg from "./assets/reload.svg";
import arrow_svg from "./assets/arrow.svg";

import { bolt11_prefix, pairs } from "./config";
import {
    convertAmount,
    denominations,
    formatAmount,
} from "./utils/denomination";
import {
    online,
    swaps,
    setSwaps,
    assetSelect,
    setAssetSelect,
    asset,
    denomination,
    setDenomination,
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
    setConfig,
    valid,
    setValid,
    setSwapValid,
    invoice,
    setInvoice,
    onchainAddress,
    setOnchainAddress,
    setNotification,
    setNotificationType,
    webln,
} from "./signals";

const Create = () => {
    const [firstLoad, setFirstLoad] = createSignal(true);

    // set fees and pairs
    createEffect(() => {
        let cfg = config()["BTC/BTC"];
        if (asset() == "L-BTC") {
            cfg = config()["L-BTC/BTC"];
        }
        if (cfg) {
            setMinimum(formatAmount(cfg.limits.minimal));
            setMaximum(formatAmount(cfg.limits.maximal));
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
    createEffect(() => {
        if ((!reverse() && invoice()) || (reverse() && onchainAddress())) {
            setSwapValid(true);
        } else {
            setSwapValid(false);
        }
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
        setSendAmountFormatted(formatAmount(sendAmount));
    };

    const changeSendAmount = (amount) => {
        let satAmount = BigInt(
            convertAmount(Number(amount), denominations.sat)
        );
        setSendAmount(satAmount);
        setSendAmountFormatted(formatAmount(Number(satAmount)));
        let receiveAmount = calculateReceiveAmount(Number(satAmount));
        setReceiveAmount(receiveAmount);
        setReceiveAmountFormatted(formatAmount(Number(receiveAmount)));
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
        setValid(true);
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
                try {
                    // validate btc address
                    address.toOutputScript(onchainAddress(), net);
                } catch (e) {
                    log.error(e);
                    setNotificationType("error");
                    setNotification("invalid onchain address");
                    return false;
                }
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
                    let msg = "wrong network";
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

    let setAssetPair = () => {
        if (pairs.length <= 1) {
            return false;
        }
        setAssetSelect(!assetSelect());
    };

    return (
        <div class="frame" data-reverse={reverse()} data-asset={asset()}>
            <h2>{t("create_swap")}</h2>
            <p>
                {t("create_swap_subline")} <br />
                Min: {minimum()}, Max: {maximum()}
            </p>
            <hr />
            <div class="icons">
                <div>
                    <div className="asset-wrap" onClick={setAssetPair}>
                        <div className="asset asset-1">
                            <div className="asset-selected">
                                <span class="icon-1 icon"></span>
                                <span class="asset-text"></span>
                                <Show when={pairs.length > 1}>
                                    <span class="arrow-down"></span>
                                </Show>
                            </div>
                        </div>
                    </div>
                    <input
                        autofocus
                        required
                        type="number"
                        id="sendAmount"
                        maxlength="10"
                        step={denomination() == "btc" ? 0.00000001 : 1}
                        min={minimum()}
                        max={maximum()}
                        value={sendAmountFormatted()}
                        onChange={(e) =>
                            changeSendAmount(e.currentTarget.value)
                        }
                        onKeyUp={(e) => changeSendAmount(e.currentTarget.value)}
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
                    <div className="asset-wrap" onClick={setAssetPair}>
                        <div className="asset asset-2">
                            <div className="asset-selected">
                                <span class="icon-2 icon"></span>
                                <span class="asset-text"></span>
                                <Show when={pairs.length > 1}>
                                    <span class="arrow-down"></span>
                                </Show>
                            </div>
                        </div>
                        <div class="assets-select"></div>
                    </div>
                    <input
                        autofocus
                        required
                        type="number"
                        id="receiveAmount"
                        maxlength="10"
                        step={denomination() == "btc" ? 0.00000001 : 1}
                        min={minimum()}
                        max={maximum()}
                        value={receiveAmountFormatted()}
                        onChange={(e) =>
                            changeReceiveAmount(e.currentTarget.value)
                        }
                        onKeyUp={(e) =>
                            changeReceiveAmount(e.currentTarget.value)
                        }
                    />
                </div>
            </div>
            <div class="fees-dyn">
                <div class="denomination">
                    <label>{t("denomination")}: </label>
                    <img
                        src={btc_svg}
                        onClick={() => setDenomination("btc")}
                        class={denomination() == "btc" ? "active" : ""}
                        alt="denominator"
                    />
                    <img
                        src={sat_svg}
                        onClick={() => setDenomination("sat")}
                        class={denomination() == "sat" ? "active" : ""}
                        alt="denominator"
                    />
                </div>
                <label>
                    <span class="icon-reload" onClick={fetchPairs}>
                        <img src={reload_svg} />
                    </span>
                    {t("network_fee")}:{" "}
                    <span class="network-fee">
                        {formatAmount(minerFee())}
                        <span
                            class="denominator"
                            data-denominator={denomination()}></span>
                    </span>
                    <br />
                    {t("fee")} ({boltzFee()}%):{" "}
                    <span class="boltz-fee">
                        {formatAmount(
                            (Number(sendAmount()) * boltzFee()) / 100
                        )}
                        <span
                            class="denominator"
                            data-denominator={denomination()}></span>
                    </span>
                </label>
            </div>
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
                onChange={(e) => setInvoice(e.currentTarget.value)}
                onKeyUp={(e) => setInvoice(e.currentTarget.value)}
                id="invoice"
                name="invoice"
                value={invoice()}
                placeholder={t("create_and_paste", {
                    amount: receiveAmountFormatted(),
                    denomination: denomination(),
                })}></textarea>
            <input
                onChange={(e) => setOnchainAddress(e.currentTarget.value)}
                onKeyUp={(e) => setOnchainAddress(e.currentTarget.value)}
                type="text"
                id="onchainAddress"
                name="onchainAddress"
                placeholder="On-chain address"
            />
            <hr />
            <Show when={online()}>
                <button id="create-swap" class="btn" onClick={create}>
                    {t("create_swap")}
                </button>
            </Show>
            <Show when={!online()}>
                <button id="create-swap" class="btn btn-danger" onClick={fetchPairs}>
                    {t("api_offline")}
                </button>
            </Show>
            <AssetSelect />
        </div>
    );
};

export default Create;
