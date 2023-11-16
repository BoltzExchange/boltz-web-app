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
                    class="btn btn-light"
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
                        class="btn btn-light"
                        type="text">
                        {address() || t("connect_to_address")}
                    </button>
                </Show>
            </Show>
        </>
    );
};

export default ConnectMetamask;
