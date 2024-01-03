import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

import { pairs } from "./config";
import { LN, sideSend } from "./consts";
import { isMobile } from "./utils/helper";

export const [config, setConfig] = createSignal({});
export const [swapStatus, setSwapStatus] = createSignal(null);

export const [online, setOnline] = createSignal(true);
export const [wasmSupported, setWasmSupported] = createSignal(true);
export const [webln, setWebln] = createSignal(false);

// fees
export const [boltzFee, setBoltzFee] = createSignal(0);
export const [minerFee, setMinerFee] = createSignal(0);

// swaps
export const [refundAddress, setRefundAddress] = createSignal(null);
export const [swap, setSwap] = createSignal(null, {
    // To allow updating properties of the swap object without replacing it completely
    equals: () => false,
});
export const [failureReason, setFailureReason] = createSignal("");
export const [timeoutEta, setTimeoutEta] = createSignal(0);
export const [timeoutBlockHeight, setTimeoutBlockheight] = createSignal(0);
export const [refundTx, setRefundTx] = createSignal("");
export const [transactionToRefund, setTransactionToRefund] = createSignal(null);

export const [i18n, setI18n] = createSignal(null);

// local storage

// To support the values created by the deprecated "createStorageSignal"
const stringSerializer = {
    serialize: (value: any) => value,
    deserialize: (value: any) => value,
};

export const [ref, setRef] = makePersisted(
    createSignal(isMobile ? "boltz_webapp_mobile" : "boltz_webapp_desktop"),
    {
        name: "ref",
        ...stringSerializer,
    },
);
export const [i18nConfigured, setI18nConfigured] = makePersisted(
    createSignal(null),
    {
        name: "i18n",
        ...stringSerializer,
    },
);
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

// notification
export const [notification, setNotification] = createSignal("");
export const [notificationType, setNotificationType] = createSignal("");
