import { SwapType } from "boltz-swaps/types";
import log from "loglevel";
import { createEffect, on } from "solid-js";

import { isEvmAsset } from "../consts/Assets";
import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import {
    DestinationInputStatus,
    DestinationInputType,
    parseDestinationInput,
} from "../utils/destinationInput";
import { formatError } from "../utils/errors";

const AddressInput = () => {
    let inputRef!: HTMLInputElement;
    let validationRequest = 0;

    const { t, notify, pairs, regularPairs, bitcoinOnly } = useGlobalContext();
    const {
        pair,
        setPair,
        minerFee,
        amountValid,
        onchainAddress,
        setAddressValid,
        setOnchainAddress,
        setInvoice,
        sendAmount,
        setAmountChanged,
        setReceiveAmount,
        setSendAmount,
    } = useCreateContext();

    const handleInputChange = async (input: HTMLInputElement) => {
        const requestId = ++validationRequest;
        const inputValue = input.value.trim();
        const isStale = () =>
            requestId !== validationRequest ||
            input.value.trim() !== inputValue;

        input.classList.remove("invalid");
        input.setCustomValidity("");

        setOnchainAddress(inputValue);
        setAddressValid(false);

        const result = await parseDestinationInput(
            inputValue,
            pair(),
            pairs(),
            regularPairs(),
            minerFee(),
            bitcoinOnly(),
            isStale,
        );

        if (result.status === DestinationInputStatus.Invalid) {
            log.debug(
                `Invalid address input: ${formatError(
                    result.cause ?? result.error,
                )}`,
            );

            const msg = t("invalid_address", {
                asset: pair().toAsset,
            });
            input.classList.add("invalid");
            input.setCustomValidity(msg);
        }

        if (result.status !== DestinationInputStatus.Valid) {
            return;
        }

        if (result.amount !== undefined) {
            setAmountChanged(Side.Receive);
            setReceiveAmount(result.amount.receiveAmount);
            setSendAmount(result.amount.sendAmount);
        }

        if (result.switched) {
            setPair(result.nextPair);
            notify("success", t("switch_paste"));
        }

        if (result.destination.type === DestinationInputType.Invoice) {
            setOnchainAddress("");
            setInvoice(result.destination.invoice);
        } else {
            setAddressValid(true);
            setOnchainAddress(result.destination.address);
        }
    };

    createEffect(
        on([amountValid, onchainAddress, pair], () => {
            if (
                sendAmount().isGreaterThan(0) &&
                pair().swapToCreate?.type !== SwapType.Submarine &&
                !isEvmAsset(pair().toAsset) &&
                onchainAddress() === ""
            ) {
                setAddressValid(false);
            }
        }),
    );

    return (
        <input
            ref={inputRef}
            required
            onInput={(e) => handleInputChange(e.currentTarget)}
            type="text"
            id="onchainAddress"
            data-testid="onchainAddress"
            name="onchainAddress"
            autocomplete="off"
            placeholder={t("onchain_address", {
                asset: pair().toAsset,
            })}
            value={onchainAddress()}
        />
    );
};

export default AddressInput;
