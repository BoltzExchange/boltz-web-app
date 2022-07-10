import { createSignal } from "solid-js";

export const [config, setConfig] = createSignal(0);
export const [boltzFee, setBoltzFee] = createSignal(0);
export const [minerFee, setMinerFee] = createSignal(0);
export const [minimum, setMinimum] = createSignal(0);
export const [maximum, setMaximum] = createSignal(0);
export const [sendAmount, setSendAmount] = createSignal(0);
export const [receiveAmount, setReceiveAmount] = createSignal(0);
export const [reverse, setReverse] = createSignal(false);
