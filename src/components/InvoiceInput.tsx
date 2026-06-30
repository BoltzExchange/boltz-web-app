import { BigNumber } from "bignumber.js";
import { isBolt12Offer } from "boltz-swaps/invoice";
import { SwapType } from "boltz-swaps/types";
import { createEffect, on } from "solid-js";

import { LN, isBitcoinOnlyAsset } from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import type { DictKey } from "../i18n/i18n";
import Pair from "../utils/Pair";
import { probeUserInput } from "../utils/compat";
import { btcToSat } from "../utils/denomination";
import {
    extractAddress,
    extractBip21Amount,
    extractInvoice,
    isLnurl,
} from "../utils/invoice";
import { validateInvoice } from "../utils/validation";

type InvoiceInputProps = {
    class?: string;
    disabled?: boolean;
    placeholder?: string;
};

const InvoiceInput = (props: InvoiceInputProps = {}) => {
    let inputRef!: HTMLInputElement;
    let validationRequest = 0;

    const { t, notify, pairs, regularPairs, bitcoinOnly } = useGlobalContext();
    const {
        pair,
        setPair,
        minerFee,
        invoice,
        amountValid,
        resetAmounts,
        setAmountChanged,
        setInvoice,
        setInvoiceValid,
        setInvoiceError,
        setLnurl,
        setReceiveAmount,
        setSendAmount,
        setOnchainAddress,
        setBolt12Offer,
        setAddressValid,
        setBolt12Loading,
        setQuoteLoading,
    } = useCreateContext();

    const clearInputError = (input: HTMLInputElement) => {
        input.classList.remove("invalid");
        input.setCustomValidity("");
        setInvoiceError(undefined);
    };

    const resetInvoiceState = () => {
        setBolt12Offer(undefined);
        setInvoiceValid(false);
        setLnurl("");
    };

    const canSwitchToAsset = (asset: string | null): asset is string =>
        asset !== LN &&
        asset !== null &&
        (!bitcoinOnly() || isBitcoinOnlyAsset(asset));

    const validateInput = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);
        const invoiceValue = extractInvoice(inputValue) ?? "";
        const actualAsset =
            probeUserInput(LN, invoiceValue) ?? probeUserInput(LN, address);

        if (!canSwitchToAsset(actualAsset)) {
            resetAmounts();
        }

        void validate(input);
    };

    const validate = async (
        input: HTMLInputElement,
        inputValue = input.value.trim(),
    ) => {
        const requestId = ++validationRequest;
        const isStale = () =>
            requestId !== validationRequest || invoice().trim() !== inputValue;

        const address = extractAddress(inputValue);
        const invoiceValue = extractInvoice(inputValue) ?? "";
        const actualAsset =
            probeUserInput(LN, invoiceValue) ?? probeUserInput(LN, address);
        const switchesToAsset = canSwitchToAsset(actualAsset);
        setInvoice(inputValue);

        try {
            if (inputValue.length === 0) {
                if (isStale()) {
                    return;
                }
                clearInputError(input);
                resetInvoiceState();
                return;
            }

            const bip21Amount = extractBip21Amount(inputValue);
            if (bip21Amount) {
                const satAmount = btcToSat(bip21Amount);
                setAmountChanged(Side.Receive);
                setReceiveAmount(satAmount);
                setQuoteLoading(true);
                const sendAmt = await pair().calculateSendAmount(
                    satAmount,
                    minerFee(),
                );
                if (isStale()) {
                    return;
                }
                setSendAmount(sendAmt);
            }

            // Auto switch direction based on address
            if (isStale()) {
                return;
            }
            if (switchesToAsset) {
                const fromAsset =
                    pair().fromAsset === actualAsset ? LN : pair().fromAsset;
                setPair(
                    new Pair(pairs(), fromAsset, actualAsset, regularPairs()),
                );
                setInvoice("");
                setOnchainAddress(address);
                setAddressValid(true);
                notify("success", t("switch_paste"));
                return;
            }

            if (isLnurl(invoiceValue)) {
                resetInvoiceState();
                setInvoice(invoiceValue);
                setLnurl(invoiceValue);
            } else {
                setBolt12Loading(true);
                let isBolt12: boolean;
                try {
                    isBolt12 = isBolt12Offer(invoiceValue);
                } finally {
                    if (!isStale()) {
                        setBolt12Loading(false);
                    }
                }
                if (isStale()) {
                    return;
                }

                if (isBolt12) {
                    resetInvoiceState();
                    setInvoice(invoiceValue);
                    setBolt12Offer(invoiceValue);
                } else {
                    const sats = validateInvoice(invoiceValue);
                    setAmountChanged(Side.Receive);
                    setQuoteLoading(true);
                    const sendAmount = await pair().calculateSendAmount(
                        BigNumber(sats),
                        minerFee(),
                    );
                    if (isStale()) {
                        return;
                    }
                    setReceiveAmount(BigNumber(sats));
                    setSendAmount(sendAmount);
                    setInvoice(invoiceValue);
                    setBolt12Offer(undefined);
                    setLnurl("");
                    setInvoiceValid(true);
                }
            }

            if (isStale()) {
                return;
            }
            clearInputError(input);
        } catch (e) {
            if (isStale()) {
                return;
            }
            const message = e instanceof Error ? e.message : String(e);
            input.classList.add("invalid");
            input.setCustomValidity(t(message as DictKey));
            resetInvoiceState();
            setInvoiceError(message as DictKey);
        } finally {
            if (!isStale()) {
                setQuoteLoading(false);
            }
        }
    };

    createEffect(
        on(
            [amountValid, invoice, pair, minerFee, () => props.disabled],
            async () => {
                if (props.disabled) {
                    return;
                }

                if (
                    pair().swapToCreate?.type === SwapType.Submarine ||
                    pair().toAsset === LN
                ) {
                    await validate(inputRef, invoice().trim());
                }
            },
        ),
    );

    return (
        <input
            required
            ref={inputRef}
            onInput={(e) => validateInput(e.currentTarget)}
            type="text"
            class={props.class}
            id="invoice"
            data-testid="invoice"
            name="invoice"
            value={invoice()}
            autocomplete="off"
            disabled={props.disabled}
            placeholder={props.placeholder ?? t("create_and_paste")}
        />
    );
};

export default InvoiceInput;
