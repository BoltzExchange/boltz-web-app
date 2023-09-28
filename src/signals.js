import { createSignal } from "solid-js";
import { createStorageSignal } from "@solid-primitives/storage";
import { isMobile } from "./helper";
import { defaultLanguage, pairs } from "./config";

// ui
export const [hamburger, setHamburger] = createSignal(false);
export const [assetSelect, setAssetSelect] = createSignal(false);
export const [assetSelected, setAssetSelected] = createSignal(0);
export const [asset, setAsset] = createSignal(Object.keys(pairs)[0].split("/")[0]);
export const [asset1, setAsset1] = createSignal(Object.keys(pairs)[0].split("/")[0]);
export const [asset2, setAsset2] = createSignal("LN");

// fees
export const [nodeStats, setNodeStats] = createSignal(null);
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
export const [swap, setSwap] = createSignal(null, {
    // To allow updating properties of the swap object without replacing it completely
    equals: () => false,
});
export const [swapStatus, setSwapStatus] = createSignal(null);
export const [swapStatusTransaction, setSwapStatusTransaction] =
    createSignal("");
export const [failureReason, setFailureReason] = createSignal("");
export const [timeoutEta, setTimeoutEta] = createSignal(0);
export const [timeoutBlockHeight, setTimeoutBlockheight] = createSignal(0);
export const [refundTx, setRefundTx] = createSignal("");
export const [transactionToRefund, setTransactionToRefund] = createSignal(null);

// local storage
export const [ref, setRef] = createStorageSignal(
    "ref",
    isMobile ? "boltz_webapp_mobile" : "boltz_webapp_desktop"
);
export const [i18n, setI18n] = createStorageSignal("i18n", defaultLanguage);
export const [denomination, setDenomination] = createStorageSignal(
    "denomination",
    "sat"
);
export const [swaps, setSwaps] = createStorageSignal("swaps", [], {
    // Because arrays are the same object when changed,
    // we have to override the equality checker
    equals: () => false,
    deserializer: (data) => {
        return JSON.parse(data);
    },
    serializer: (data) => {
        return JSON.stringify(data);
    },
});
export const [reverse, setReverse] = createSignal(true);

// validation
export const [valid, setValid] = createSignal(false);
export const [invoiceValid, setInvoiceValid] = createSignal(false);
export const [addressValid, setAddressValid] = createSignal(false);

// notification
export const [notification, setNotification] = createSignal("");
export const [notificationType, setNotificationType] = createSignal("");

export const [webln, setWebln] = createSignal(false);
