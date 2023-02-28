import { createSignal } from "solid-js";
import { createStorageSignal } from "@solid-primitives/storage";

// ui
export const [hamburger, setHamburger] = createSignal(false);

// fees
export const [config, setConfig] = createSignal(0);
export const [boltzFee, setBoltzFee] = createSignal(0);
export const [minerFee, setMinerFee] = createSignal(0);
export const [minimum, setMinimum] = createSignal(0);
export const [maximum, setMaximum] = createSignal(0);

// swaps
export const [receiveAmount, setReceiveAmount] = createSignal(0);
export const [reverse, setReverse] = createSignal(false);
export const [onchainAddress, setOnchainAddress] = createSignal("");
export const [invoice, setInvoice] = createSignal("");
export const [invoiceQr, setInvoiceQr] = createSignal("");
export const [preimageHash, setPreimageHash] = createSignal("");
export const [preimage, setPreimage] = createSignal("");
export const [swap, setSwap] = createSignal(null);
export const [swapStatus, setSwapStatus] = createSignal("");
export const [failureReason, setFailureReason] = createSignal("");

// local storage
export const [i18n, setI18n] = createStorageSignal("i18n", "en");
export const [denomination, setDenomination] = createStorageSignal("denomination", "sat");
export const [asset, setAsset] = createStorageSignal("asset", "btc");
export const [sendAmount, setSendAmount] = createStorageSignal("sendAmount", 0);
export const [swaps, setSwaps] = createStorageSignal("swaps", "[]");

// validation
export const [valid, setValid] = createSignal(false);
export const [amountValid, setAmountValid] = createSignal(false);
export const [swapValid, setSwapValid] = createSignal(false);

// notification
export const [notification, setNotification] = createSignal("");
export const [notificationType, setNotificationType] = createSignal("");

// refund
export const [upload, setUpload] = createSignal(0);
