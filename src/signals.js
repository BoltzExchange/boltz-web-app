import { createEffect, createSignal } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import { isMobile } from "./helper";
import { LN, sideSend } from "./consts";
import { defaultLanguage, pairs } from "./config";

const defaultSelection = Object.keys(pairs)[0].split("/")[0];

// ui
export const [hamburger, setHamburger] = createSignal(false);
export const [assetSelect, setAssetSelect] = createSignal(false);
export const [assetSelected, setAssetSelected] = createSignal();
export const [asset, setAsset] = createSignal(defaultSelection);
export const [reverse, setReverse] = createSignal(true);

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
export const [amountChanged, setAmountChanged] = createSignal(sideSend);
export const [sendAmount, setSendAmount] = createSignal(BigInt(0));
export const [receiveAmount, setReceiveAmount] = createSignal(BigInt(0));
export const [sendAmountFormatted, setSendAmountFormatted] = createSignal(0);
export const [receiveAmountFormatted, setReceiveAmountFormatted] =
    createSignal(0);
export const [refundAddress, setRefundAddress] = createSignal(null);
export const [onchainAddress, setOnchainAddress] = createSignal("");
export const [invoice, setInvoice] = createSignal("");
export const [invoiceQr, setInvoiceQr] = createSignal("");
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

// To support the values created by the deprecated "createStorageSignal"
const stringSerializer = {
    serialize: (value) => value,
    deserialize: (value) => value,
};

export const [ref, setRef] = makePersisted(
    createSignal(isMobile ? "boltz_webapp_mobile" : "boltz_webapp_desktop"),
    {
        name: "ref",
        ...stringSerializer,
    },
);
export const [i18n, setI18n] = makePersisted(createSignal(defaultLanguage), {
    name: "i18n",
    ...stringSerializer,
});
export const [denomination, setDenomination] = makePersisted(
    createSignal("sat"),
    { name: "denomination", ...stringSerializer },
);
export const [swaps, setSwaps] = makePersisted(
    createSignal([], {
        // Because arrays are the same object when changed,
        // we have to override the equality checker
        equals: () => false,
    }),
    {
        name: "swaps",
    },
);

export const [assetReceive, setAssetReceive] = makePersisted(
    createSignal(defaultSelection),
    { name: "assetReceive" },
);
export const [assetSend, setAssetSend] = makePersisted(createSignal(LN), {
    name: "assetSend",
});

// validation
export const [valid, setValid] = createSignal(false);
export const [invoiceValid, setInvoiceValid] = createSignal(false);
export const [addressValid, setAddressValid] = createSignal(false);

// notification
export const [notification, setNotification] = createSignal("");
export const [notificationType, setNotificationType] = createSignal("");

export const [webln, setWebln] = createSignal(false);

// effects
createEffect(() => setReverse(assetReceive() !== LN));

[assetSend, assetReceive].forEach((signal) => {
    createEffect(() => {
        if (signal() !== LN) {
            setAsset(signal());
        }
    });
});
