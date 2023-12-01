import { Show, createEffect, createSignal } from "solid-js";

import { useWeb3Signer } from "../context/Web3";
import t from "../i18n";
import {
    addressValid,
    sendAmountValid,
    setAddressValid,
    setOnchainAddress,
} from "../signals";
import { setButtonLabel } from "./CreateButton";

const ConnectMetamask = ({ showAddress }) => {
    const [address, setAddress] = createSignal<string | undefined>();
    const [buttonText, setButtonText] = createSignal<string | undefined>();

    const setButtonTextAddress = () => {
        setButtonText(address() || t("connect_to_address"));
    };

    createEffect(() => {
        setButtonTextAddress();
    });

    createEffect(() => {
        setAddressValid(address() !== undefined);
        setOnchainAddress(address());
    });

    createEffect(() => {
        if (sendAmountValid() && !addressValid()) {
            setButtonLabel(t("connect_metamask"));
        }
    });

    const { getSigner } = useWeb3Signer();

    return (
        <>
            <Show when={address() === undefined}>
                <button
                    id="metamask"
                    class="btn"
                    onClick={async () =>
                        setAddress(await (await getSigner()).getAddress())
                    }>
                    {t("connect_metamask")}
                </button>
            </Show>
            <Show when={address() !== undefined}>
                <Show when={showAddress}>
                    <button
                        onClick={() => setAddress(undefined)}
                        onMouseEnter={() =>
                            setButtonText(t("disconnect_address"))
                        }
                        onMouseLeave={() => setButtonTextAddress()}
                        class="btn btn-light">
                        {buttonText()}
                    </button>
                </Show>
            </Show>
        </>
    );
};

export default ConnectMetamask;
