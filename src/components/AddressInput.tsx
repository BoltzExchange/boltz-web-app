import log from "loglevel";
import { createEffect, on } from "solid-js";
import { btcToSat } from "src/utils/denomination";

import { LN, isEvmAsset } from "../consts/Assets";
import { Side, SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import { probeUserInput } from "../utils/compat";
import { formatError } from "../utils/errors";
import {
    extractAddress,
    extractBip21Amount,
    extractInvoice,
} from "../utils/invoice";

const AddressInput = () => {
    let inputRef: HTMLInputElement;

    const { t, notify, pairs, regularPairs } = useGlobalContext();
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
        const inputValue = input.value.trim();
        setOnchainAddress(inputValue);

        if (inputValue.length === 0) {
            setAddressValid(false);
            input.classList.remove("invalid");
            input.setCustomValidity("");
            return;
        }

        const address = extractAddress(inputValue);
        const invoice = extractInvoice(inputValue);

        const bip21Amount = extractBip21Amount(inputValue);
        if (bip21Amount) {
            const satAmount = btcToSat(bip21Amount);
            setAmountChanged(Side.Receive);
            setReceiveAmount(satAmount);
            const sendAmt = await pair().calculateSendAmount(
                satAmount,
                minerFee(),
            );
            setSendAmount(sendAmt);
        }

        try {
            const assetName = pair().toAsset;
            const actualAsset =
                (await probeUserInput(assetName, invoice)) ??
                (await probeUserInput(assetName, address));

            switch (actualAsset) {
                case LN: {
                    setPair(
                        new Pair(
                            pairs(),
                            pair().fromAsset === LN
                                ? assetName
                                : pair().fromAsset,
                            LN,
                            regularPairs(),
                        ),
                    );
                    setOnchainAddress("");
                    setInvoice(invoice);
                    notify("success", t("switch_paste"));
                    break;
                }

                case null:
                    throw new Error();

                default: {
                    if (assetName !== actualAsset) {
                        setPair(
                            new Pair(
                                pairs(),
                                pair().toAsset,
                                actualAsset,
                                regularPairs(),
                            ),
                        );
                        notify("success", t("switch_paste"));
                    }

                    input.setCustomValidity("");
                    input.classList.remove("invalid");
                    setAddressValid(true);
                    setOnchainAddress(address);
                    break;
                }
            }
        } catch (e) {
            setAddressValid(false);

            if (inputValue.length !== 0) {
                log.debug(`Invalid address input: ${formatError(e)}`);

                const msg = t("invalid_address", { asset: pair().toAsset });
                input.classList.add("invalid");
                input.setCustomValidity(msg);
            }
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
            placeholder={t("onchain_address", { asset: pair().toAsset })}
            value={onchainAddress()}
        />
    );
};

export default AddressInput;
