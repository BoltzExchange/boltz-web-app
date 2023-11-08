import { createEffect, createSignal, Show } from "solid-js";
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
            <button
                id="create-swap"
                class="btn"
                onClick={async () =>
                    setAddress(await (await getSigner()).getAddress())
                }>
                Connect Metamask
            </button>
            <Show when={showAddress !== undefined ? showAddress : true}>
                <input
                    disabled
                    type="text"
                    value={address() || "Connect Metamask to set address"}
                    placeholder={"Address"}
                />
            </Show>
        </>
    );
};

export default ConnectMetamask;
