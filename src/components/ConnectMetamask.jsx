import { Show, createEffect, createSignal } from "solid-js";

import { useWeb3Signer } from "../context/Web3";
import t from "../i18n";
import { setAddressValid, setOnchainAddress } from "../signals";

const ConnectMetamask = ({ showAddress }) => {
    const [address, setAddress] = createSignal();
    const [buttonText, setButtonText] = createSignal();

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
                        class="btn btn-light"
                        type="text">
                        {buttonText()}
                    </button>
                </Show>
            </Show>
        </>
    );
};

export default ConnectMetamask;
