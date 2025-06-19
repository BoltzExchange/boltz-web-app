import { BigNumber } from "bignumber.js";
import { Show, createEffect, createSignal, on } from "solid-js";

import { BTC, LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { fetchBip21Invoice } from "../utils/boltzClient";
import { calculateSendAmount } from "../utils/calculate";
import { probeUserInput } from "../utils/compat";
import { btcToSat } from "../utils/denomination";
import {
    decodeInvoice,
    extractAddress,
    extractInvoice,
    getAssetByBip21Prefix,
    isBolt12Offer,
    isLnurl,
} from "../utils/invoice";
import { findMagicRoutingHint } from "../utils/magicRoutingHint";
import { validateInvoice } from "../utils/validation";
import LoadingSpinner from "./LoadingSpinner";

const InvoiceInput = () => {
    let inputRef: HTMLTextAreaElement;

    const { t, notify, notification } = useGlobalContext();
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
        setRoutingHint,
    } = useCreateContext();
    const [loadingBip21, setLoadingBip21] = createSignal(false);

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
        const val = input.value.trim() || invoice();

        const address = extractAddress(val);
        const actualAsset = probeUserInput(LN, address);

        // Auto switch direction based on address
        if (actualAsset !== LN && actualAsset !== null) {
            setAssetSend(assetSend() === actualAsset ? LN : assetSend());
            setAssetReceive(actualAsset);
            setOnchainAddress(address);
            notify("success", t("switch_paste"));
            return;
        }

        const inputValue = extractInvoice(val);

        if (inputValue.length === 0) {
            clearInputError(input);
            resetInvoiceState();
            return;
        }

        try {
            if (isLnurl(inputValue)) {
                setLnurl(inputValue);
                clearInputError(input);
                return;
            }

            if (await isBolt12Offer(inputValue)) {
                setBolt12Offer(inputValue);
                clearInputError(input);
                return;
            }

            const sats = await validateInvoice(inputValue);
            const magicRoutingHint = findMagicRoutingHint(inputValue);
            setInvoice(inputValue);

            if (magicRoutingHint) {
                setLoadingBip21(true);
                const bip21 = await fetchBip21Invoice(inputValue);
                const bip21Decoded = new URL(bip21.bip21);
                const chainAddress = bip21Decoded.pathname;
                const bip21Amount = BigNumber(
                    bip21Decoded.searchParams.get("amount") ?? 0,
                );
                if (btcToSat(bip21Amount).isGreaterThan(sats)) {
                    throw t("invalid_bip21_amount");
                }

                setAssetSend(BTC);
                setAssetReceive(getAssetByBip21Prefix(bip21Decoded.protocol));
                setOnchainAddress(chainAddress);
                setAddressValid(true);
                setReceiveAmount(BigNumber(sats));
                setSendAmount(
                    calculateSendAmount(
                        BigNumber(sats),
                        boltzFee(),
                        minerFee(),
                        swapType(),
                    ),
                );
                setLoadingBip21(false);
                setRoutingHint(magicRoutingHint);
                if (!notification()) {
                    notify("success", t("magic_routing_hint_explainer"));
                }
                clearInputError(input);
                return;
            }

            setReceiveAmount(BigNumber(sats));
            setSendAmount(
                calculateSendAmount(
                    BigNumber(sats),
                    boltzFee(),
                    minerFee(),
                    swapType(),
                ),
            );

            setInvoice(inputValue);
            setBolt12Offer(undefined);
            setLnurl("");
            setInvoiceValid(true);
            clearInputError(input);
        } catch (e) {
            input.classList.add("invalid");
            input.setCustomValidity(t(e.message));
            resetInvoiceState();
            setInvoiceError(e.message);
        } finally {
            setLoadingBip21(false);
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
                !receiveAmount().isZero() &&
                !findMagicRoutingHint(invoice())
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
        <Show when={!loadingBip21()} fallback={<LoadingSpinner />}>
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
        </Show>
    );
};

export default InvoiceInput;
