import log from "loglevel";
import { Show, createEffect, on } from "solid-js";

import { LN, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { probeUserInput } from "../utils/compat";
import { formatError } from "../utils/errors";
import { extractAddress, extractInvoice } from "../utils/invoice";
import Tooltip from "./settings/Tooltip";

const AddressInput = () => {
    let inputRef: HTMLInputElement;

    const { t, notify } = useGlobalContext();
    const {
        assetReceive,
        swapType,
        amountValid,
        onchainAddress,
        setAddressValid,
        setAssetReceive,
        setAssetSend,
        assetSend,
        setOnchainAddress,
        setInvoice,
        sendAmount,
        routingHint,
        setRoutingHint,
    } = useCreateContext();

    const handleInputChange = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);
        const invoice = extractInvoice(inputValue);
        setRoutingHint(undefined);

        try {
            const assetName = assetReceive();
            const actualAsset = probeUserInput(assetName, address);

            switch (actualAsset) {
                case LN:
                    setAssetReceive(LN);
                    if (assetSend() === LN) {
                        setAssetSend(assetName);
                    }
                    setInvoice(invoice);
                    notify("success", t("switch_paste"));
                    break;

                case null:
                    throw new Error();

                default:
                    if (assetName !== actualAsset) {
                        setAssetSend(assetReceive());
                        setAssetReceive(actualAsset);
                        notify("success", t("switch_paste"));
                    }
                    input.setCustomValidity("");
                    input.classList.remove("invalid");
                    setAddressValid(true);
                    setOnchainAddress(address);
                    break;
            }
        } catch (e) {
            setAddressValid(false);

            if (inputValue.length !== 0) {
                log.debug(`Invalid address input: ${formatError(e)}`);

                const msg = t("invalid_address", { asset: assetReceive() });
                input.classList.add("invalid");
                input.setCustomValidity(msg);
            }
        }
    };

    createEffect(
        on([amountValid, onchainAddress, assetReceive], () => {
            if (
                sendAmount().isGreaterThan(0) &&
                swapType() !== SwapType.Submarine &&
                assetReceive() !== RBTC &&
                onchainAddress() === ""
            ) {
                setAddressValid(false);
            }
        }),
    );

    return (
        <div
            style={{
                position: "relative",
            }}>
            <input
                ref={inputRef}
                required
                onInput={(e) => handleInputChange(e.currentTarget)}
                type="text"
                id="onchainAddress"
                data-testid="onchainAddress"
                name="onchainAddress"
                autocomplete="off"
                placeholder={t("onchain_address", { asset: assetReceive() })}
                value={onchainAddress()}
                style={{
                    "padding-right": "2.5rem",
                }}
            />
            <Show when={routingHint()}>
                <span class="input-tooltip">
                    <Tooltip
                        label={"magic_routing_hint_explainer"}
                        position="left"
                    />
                </span>
            </Show>
        </div>
    );
};

export default AddressInput;
