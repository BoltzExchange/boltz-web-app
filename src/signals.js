import { createSignal } from "solid-js";
import { createStorageSignal } from "@solid-primitives/storage";
import { pairs } from "./config";

// ui
export const [hamburger, setHamburger] = createSignal(false);
export const [assetSelect, setAssetSelect] = createSignal(false);

// fees
export const [config, setConfig] = createSignal(0);
export const [online, setOnline] = createSignal(true);
export const [wasmSupported, setWasmSupported] = createSignal(true);

export const [boltzFee, setBoltzFee] = createSignal(0);
export const [minerFee, setMinerFee] = createSignal(0);
export const [minimum, setMinimum] = createSignal(0);
export const [maximum, setMaximum] = createSignal(0);

// swaps
export const [sendAmount, setSendAmount] = createSignal(BigInt(0));
export const [receiveAmount, setReceiveAmount] = createSignal(BigInt(0));
export const [sendAmountFormatted, setSendAmountFormatted] = createSignal(0);
export const [receiveAmountFormatted, setReceiveAmountFormatted] =
    createSignal(0);
export const [refundAddress, setRefundAddress] = createSignal(null);
export const [onchainAddress, setOnchainAddress] = createSignal("");
export const [invoice, setInvoice] = createSignal("");
export const [invoiceQr, setInvoiceQr] = createSignal("");
export const [preimageHash, setPreimageHash] = createSignal("");
export const [preimage, setPreimage] = createSignal("");
export const [swap, setSwap] = createSignal(null);
export const [swapStatus, setSwapStatus] = createSignal("");
export const [swapStatusTransaction, setSwapStatusTransaction] =
    createSignal("");
export const [failureReason, setFailureReason] = createSignal("");
export const [timeoutEta, setTimeoutEta] = createSignal(0);
export const [timeoutBlockHeight, setTimeoutBlockheight] = createSignal(0);
export const [refundTx, setRefundTx] = createSignal("");
export const [transactionToRefund, setTransactionToRefund] = createSignal(null);

// local storage
export const [ref, setRef] = createStorageSignal("ref", "boltz_webapp");
export const [i18n, setI18n] = createStorageSignal("i18n", "en");
export const [denomination, setDenomination] = createStorageSignal(
    "denomination",
    "sat"
);
export const [asset, setAsset] = createStorageSignal(
    "asset",
    pairs[0].split("/")[0]
);
export const [swaps, setSwaps] = createStorageSignal("swaps", "[]");
export const [reverse, setReverse] = createSignal(true);

// validation
export const [valid, setValid] = createSignal(false);
export const [invoiceValid, setInvoiceValid] = createSignal(false);
export const [addressValid, setAddressValid] = createSignal(false);

// notification
export const [notification, setNotification] = createSignal("");
export const [notificationType, setNotificationType] = createSignal("");

export const [webln, setWebln] = createSignal(false);

export const refundAddressChange = (e) => {
    const addr = e.currentTarget.value;
    if (addr) {
        setRefundAddress(addr.trim());
    } else {
        setRefundAddress(null);
    }
};
