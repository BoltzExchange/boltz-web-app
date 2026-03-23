import { sha256 } from "@noble/hashes/sha2.js";
import { base58 } from "@scure/base";
import { getAddress, isAddress } from "ethers";
import log from "loglevel";
import { createEffect, on } from "solid-js";
import { btcToSat } from "src/utils/denomination";

import {
    LN,
    getNetworkTransport,
    isBitcoinOnlyAsset,
    isEvmAsset,
} from "../consts/Assets";
import { NetworkTransport } from "../configs/base";
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

const isValidSolanaAddress = (address: string) => {
    try {
        return base58.decode(address).length === 32;
    } catch {
        return false;
    }
};

const isValidTronAddress = (address: string) => {
    try {
        const decoded = base58.decode(address);
        if (decoded.length !== 25) {
            return false;
        }

        const payload = decoded.subarray(0, 21);
        const checksum = decoded.subarray(21);
        const expectedChecksum = sha256(sha256(payload)).slice(0, 4);
        return (
            payload[0] === 0x41 &&
            checksum.every((byte, index) => byte === expectedChecksum[index])
        );
    } catch {
        return false;
    }
};

const AddressInput = () => {
    let inputRef: HTMLInputElement;

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
            if (isEvmAsset(assetName)) {
                if (!isAddress(address)) {
                    throw new Error();
                }

                input.setCustomValidity("");
                input.classList.remove("invalid");
                setAddressValid(true);
                setOnchainAddress(getAddress(address));
                return;
            }

            const transport = getNetworkTransport(assetName);
            if (transport === NetworkTransport.Solana) {
                if (!isValidSolanaAddress(address)) {
                    throw new Error();
                }

                input.setCustomValidity("");
                input.classList.remove("invalid");
                setAddressValid(true);
                setOnchainAddress(address);
                return;
            }

            if (transport === NetworkTransport.Tron) {
                if (!isValidTronAddress(address)) {
                    throw new Error();
                }

                input.setCustomValidity("");
                input.classList.remove("invalid");
                setAddressValid(true);
                setOnchainAddress(address);
                return;
            }

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
                    if (bitcoinOnly() && !isBitcoinOnlyAsset(actualAsset)) {
                        throw new Error();
                    }

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

                const msg = t("invalid_address", {
                    asset: pair().toAsset,
                });
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
            placeholder={t("onchain_address", {
                asset: pair().toAsset,
            })}
            value={onchainAddress()}
        />
    );
};

export default AddressInput;
