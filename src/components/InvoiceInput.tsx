import { BigNumber } from "bignumber.js";
import { createEffect, on } from "solid-js";

import { LN, isBitcoinOnlyAsset } from "../consts/Assets";
import { Side, SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import { probeUserInput } from "../utils/compat";
import { btcToSat } from "../utils/denomination";
import {
    decodeInvoice,
    extractAddress,
    extractBip21Amount,
    extractInvoice,
    isBolt12Offer,
    isLnurl,
} from "../utils/invoice";
import { validateInvoice } from "../utils/validation";

const InvoiceInput = () => {
    let inputRef: HTMLTextAreaElement;
    let validationRequest = 0;

    const { t, notify, pairs, regularPairs, bitcoinOnly } = useGlobalContext();
    const {
        pair,
        setPair,
        minerFee,
        invoice,
        receiveAmount,
        sendAmount,
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
    } = useCreateContext();

    const clearInputError = (input: HTMLTextAreaElement) => {
        input.classList.remove("invalid");
        input.setCustomValidity("");
        setInvoiceError(undefined);
    };

    const resetInvoiceState = () => {
        setBolt12Offer(undefined);
        setInvoiceValid(false);
        setLnurl("");
    };

    const validate = async (input: HTMLTextAreaElement) => {
        const requestId = ++validationRequest;
        const inputValue = input.value.trim();
        const isStale = () =>
            requestId !== validationRequest ||
            input.value.trim() !== inputValue;

        setInvoice(inputValue);
        setBolt12Loading(false);

        if (inputValue.length === 0) {
            if (isStale()) {
                return;
            }
            clearInputError(input);
            resetInvoiceState();
            return;
        }

        const address = extractAddress(inputValue);
        const invoiceValue = extractInvoice(inputValue);

        const actualAsset =
            (await probeUserInput(LN, invoiceValue)) ??
            (await probeUserInput(LN, address));
        if (isStale()) {
            return;
        }

        const bip21Amount = extractBip21Amount(inputValue);
        if (bip21Amount) {
            const satAmount = btcToSat(bip21Amount);
            setAmountChanged(Side.Receive);
            setReceiveAmount(satAmount);
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
        if (
            actualAsset !== LN &&
            actualAsset !== null &&
            (!bitcoinOnly() || isBitcoinOnlyAsset(actualAsset))
        ) {
            const fromAsset =
                pair().fromAsset === actualAsset ? LN : pair().fromAsset;
            setPair(new Pair(pairs(), fromAsset, actualAsset, regularPairs()));
            setInvoice("");
            setOnchainAddress(address);
            setAddressValid(true);
            notify("success", t("switch_paste"));
            return;
        }

        try {
            if (isLnurl(invoiceValue)) {
                setLnurl(invoiceValue);
                setInvoice(invoiceValue);
            } else {
                setBolt12Loading(true);
                let isBolt12: boolean;
                try {
                    isBolt12 = await isBolt12Offer(invoiceValue);
                } finally {
                    if (!isStale()) {
                        setBolt12Loading(false);
                    }
                }
                if (isStale()) {
                    return;
                }

                if (isBolt12) {
                    setBolt12Offer(invoiceValue);
                    setInvoice(invoiceValue);
                } else {
                    const sats = await validateInvoice(invoiceValue);
                    if (isStale()) {
                        return;
                    }
                    const sendAmount = await pair().calculateSendAmount(
                        BigNumber(sats),
                        minerFee(),
                    );
                    if (isStale()) {
                        return;
                    }
                    setAmountChanged(Side.Receive);
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
            input.classList.add("invalid");
            input.setCustomValidity(t(e.message));
            resetInvoiceState();
            setInvoiceError(e.message);
        }
    };

    createEffect(
        on([invoice, pair, minerFee], async () => {
            if (
                pair().swapToCreate?.type === SwapType.Submarine ||
                pair().toAsset === LN
            ) {
                await validate(inputRef);
            }
        }),
    );

    // reset invoice if amount is changed
    createEffect(
        on([receiveAmount, sendAmount, invoice], async () => {
            const amount = Number(receiveAmount());
            if (
                invoice() !== "" &&
                !isLnurl(invoice()) &&
                !receiveAmount().isZero()
            ) {
                try {
                    const inv = await decodeInvoice(invoice());
                    if (inv.satoshis !== 0 && inv.satoshis !== amount) {
                        setInvoice("");
                    }

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (e) {
                    return;
                }
            }
        }),
    );

    return (
        <textarea
            required
            ref={inputRef}
            onInput={(e) => validate(e.currentTarget)}
            id="invoice"
            class="invoice-input"
            data-testid="invoice"
            name="invoice"
            value={invoice()}
            autocomplete="off"
            placeholder={t("create_and_paste")}
        />
    );
};

export default InvoiceInput;
