import { createSignal, createEffect } from "solid-js";
import { render } from "solid-js/web";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, qr } from "./helper";

import {
    step,
    setStep,
    invoice,
    setInvoice,
    refundECPair,
    setRefundECPair,
    reverse,
    valid,
    setInvoiceQr,
    sendAmount,
    preimage,
    setPreimage,
    preimageHash,
    claimECPair,
    setClaimECPair,
    // store,
    // setStorn,
} from "./signals";

import Step0 from "./Step0";
import Step1 from "./Step1";
import Success from "./Success";

// setStore("onchain_address", "LOOOOOOOOOOOOL")

const create = () => {};
// const create = (e) => {
    //   if (valid()) {
        //     let params = null;
        //     let cb = null;
        //     if (reverse()) {
            //       setPreimage(randomBytes(32));
            //       setClaimECPair(ECPair.makeRandom());
            //       params = {
                //         "type": "reversesubmarine",
                //         "pairId": "BTC/BTC",
                //         "orderSide": "buy",
                //         "invoiceAmount": sendAmount(),
                //         "preimageHash": crypto.sha256(preimage()).toString("hex"),
                //         "claimPublicKey": claimECPair().publicKey.toString("hex")
                //       };
            //       cb = (data) => {
                //         setStep(2);
                //       };
            //     } else {
                //       setRefundECPair(ECPair.makeRandom());
                //       params = {
                    //         "type": "submarine",
                    //         "pairId": "BTC/BTC",
                    //         "orderSide": "sell",
                    //         "refundPublicKey": refundECPair().publicKey.toString("hex"),
                    //         "invoice": invoice()
                    //       };
                //       cb = (data) => {
                    //         qr(data.bip21, setInvoiceQr);
                    //         setStep(1);
                    //       };
                //     }
        //     fetcher("/createswap", cb, params);
        //   };
    // };

const success = (e) => setStep(2);

const Steps = () => {
    const [t, { add, locale, dict }] = useI18n();
    return (
        <div class="frame">
            <div class={step() == 0 ? "active" : ""}>
                <div class="step0">
                    <Step0 />
                    <span class="btn btn-success" onClick={create}>{t("create_swap")}</span>
                </div>
            </div>
            <div class={step() == 1 ? "active" : ""}>
                <div class="step1">
                    <Step1 />
                    <span class="btn btn-danger" onClick={(e) => setStep(0)}>{t("cancel_swap")}</span>
                    <span class="btn btn-success" onClick={success}>{t("success_swap")}</span>
                </div>
            </div>
            <div class={step() == 2 ? "active" : ""}>
                <div class="step2">
                    <Success />
                    <hr />
                    <span class="btn btn-success" onClick={(e) => setStep(0)}>{t("new_swap")}</span>
                    <a class="btn" target="_blank" href="https://mempool.space">{t("mempool")}</a>
                </div>
            </div>
        </div>
    );
};

export default Steps;
