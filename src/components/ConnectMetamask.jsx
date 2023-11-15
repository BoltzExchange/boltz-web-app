import { createEffect, createSignal, Show } from "solid-js";
import t from "../i18n";
import { useWeb3Signer } from "../context/Web3.jsx";
import { setAddressValid, setOnchainAddress } from "../signals.js";

const ConnectMetamask = ({ showAddress }) => {
    const [address, setAddress] = createSignal();

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
                <button
                    id="metamask"
                    class="btn btn-light"
                    onClick={() => setAddress(undefined)}>
                    {t("disconnect_metamask")}
                </button>
            </Show>

            <br />
            <Show when={showAddress}>
                <input
                    disabled
                    type="text"
                    value={address() || t("connect_to_address")}
                />
            </Show>
        </>
    );
};

export default ConnectMetamask;
