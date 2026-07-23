import { Show } from "solid-js";
import { isAddress } from "viem";

import { getAssetDisplaySymbol, getAssetNetwork } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import ConnectWallet from "./ConnectWallet";

// Refund destination selection: enter an address manually or connect a
// wallet; `hideInput` is for callers that resolve the destination elsewhere
const EvmRefundDestination = (props: {
    asset: string;
    hideInput?: boolean;
    value: string;
    setValue: (value: string) => void;
}) => {
    const { t } = useGlobalContext();
    const { signer } = useWeb3Signer();

    const showInput = () => signer() === undefined && !props.hideInput;
    const trimmed = () => props.value.trim();

    return (
        <>
            <Show when={showInput()}>
                <p style={{ color: "var(--color-text)" }}>
                    {t("evm_refund_address_header", {
                        network: getAssetNetwork(props.asset),
                        symbol: getAssetDisplaySymbol(props.asset),
                    })}
                </p>
                <input
                    data-testid="refundAddress"
                    value={props.value}
                    onInput={(event) =>
                        props.setValue(event.currentTarget.value)
                    }
                    classList={{
                        invalid: trimmed() !== "" && !isAddress(trimmed()),
                    }}
                    type="text"
                    name="refundAddress"
                    autocomplete="off"
                    placeholder={t("evm_address_placeholder", {
                        network: getAssetNetwork(props.asset),
                    })}
                />
                <p style={{ margin: "5px 0" }}>{t("or")}</p>
            </Show>
            <Show when={signer() !== undefined}>
                <p data-testid="refund-destination">
                    {t("refund_destination_hint", {
                        symbol: getAssetDisplaySymbol(props.asset),
                        network: getAssetNetwork(props.asset),
                    })}
                </p>
            </Show>
            <Show when={showInput() || signer() !== undefined}>
                <ConnectWallet asset={props.asset} />
            </Show>
        </>
    );
};

export default EvmRefundDestination;
