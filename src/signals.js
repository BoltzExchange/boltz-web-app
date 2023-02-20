import { createSignal } from "solid-js";
import { createStorageSignal } from "@solid-primitives/storage";

export const [step, setStep] = createSignal(0);
export const [hamburger, setHamburger] = createSignal(false);
export const [config, setConfig] = createSignal(0);
export const [upload, setUpload] = createSignal(0);
export const [boltzFee, setBoltzFee] = createSignal(0);
export const [minerFee, setMinerFee] = createSignal(0);
export const [minimum, setMinimum] = createSignal(0);
export const [maximum, setMaximum] = createSignal(0);
export const [receiveAmount, setReceiveAmount] = createSignal(0);
export const [reverse, setReverse] = createSignal(false);
export const [valid, setValid] = createSignal(false);
export const [onchainAddress, setOnchainAddress] = createSignal("");
export const [invoice, setInvoice] = createSignal("");
export const [invoiceQr, setInvoiceQr] = createSignal("");
export const [claimECPair, setClaimECPair] = createSignal("");
export const [refundECPair, setRefundECPair] = createSignal("");
export const [preimageHash, setPreimageHash] = createSignal("");
export const [preimage, setPreimage] = createSignal("");

export const [i18n, setI18n] = createStorageSignal("i18n", "en");
export const [denomination, setDenomination] = createStorageSignal("denomination", "sat");
export const [asset, setAsset] = createStorageSignal("asset", "btc");
export const [sendAmount, setSendAmount] = createStorageSignal("sendAmount", 0);
