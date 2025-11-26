import { BigNumber } from "bignumber.js";
import { createEffect, on } from "solid-js";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { calculateSendAmount } from "../utils/calculate";
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

    const { t, notify } = useGlobalContext();
    const {
        boltzFee,
        minerFee,
        invoice,
        receiveAmount,
        swapType,
        sendAmount,
        amountValid,
        setInvoice,
        setInvoiceValid,
        setInvoiceError,
        setLnurl,
        setReceiveAmount,
        setSendAmount,
        setAssetSend,
        assetSend,
        setAssetReceive,
        setOnchainAddress,
        setBolt12Offer,
        setAddressValid,
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
        const inputValue = input.value.trim();
        setInvoice(inputValue);

        if (inputValue.length === 0) {
            clearInputError(input);
            resetInvoiceState();
            return;
        }

        const address = extractAddress(inputValue);
        const invoice = extractInvoice(inputValue);

        const actualAsset =
            (await probeUserInput(LN, invoice)) ??
            (await probeUserInput(LN, address));

        const bip21Amount = extractBip21Amount(inputValue);
        if (bip21Amount) {
            setReceiveAmount(btcToSat(bip21Amount));
            setSendAmount(
                calculateSendAmount(
                    btcToSat(bip21Amount),
                    boltzFee(),
                    minerFee(),
                    swapType(),
                ),
            );
        }

        // Auto switch direction based on address
        if (actualAsset !== LN && actualAsset !== null) {
            setAssetSend(assetSend() === actualAsset ? LN : assetSend());
            setAssetReceive(actualAsset);
            setInvoice("");
            setOnchainAddress(address);
            setAddressValid(true);
            notify("success", t("switch_paste"));
            return;
        }

        try {
            if (isLnurl(invoice)) {
                setLnurl(invoice);
                setInvoice(invoice);
            } else if (await isBolt12Offer(invoice)) {
                setBolt12Offer(invoice);
                setInvoice(invoice);
            } else {
                const sats = await validateInvoice(invoice);
                setReceiveAmount(BigNumber(sats));
                setSendAmount(
                    calculateSendAmount(
                        BigNumber(sats),
                        boltzFee(),
                        minerFee(),
                        swapType(),
                    ),
                );
                setInvoice(invoice);
                setBolt12Offer(undefined);
                setLnurl("");
                setInvoiceValid(true);
            }

            clearInputError(input);
        } catch (e) {
            input.classList.add("invalid");
            input.setCustomValidity(t(e.message));
            resetInvoiceState();
            setInvoiceError(e.message);
        }
    };

    createEffect(
        on([amountValid, invoice], async () => {
            if (swapType() === SwapType.Submarine) {
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
                    if (inv.satoshis !== amount) {
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
