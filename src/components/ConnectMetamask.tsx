import { Show, createEffect, createSignal } from "solid-js";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";

const ConnectMetamask = ({ showAddress }) => {
    const [address, setAddress] = createSignal<string | undefined>();
    const [buttonText, setButtonText] = createSignal<string | undefined>();

    const { t } = useGlobalContext();
    const { setAddressValid, setOnchainAddress } = useCreateContext();

    const setButtonTextAddress = () => {
        setButtonText(address() || t("connect_to_address"));
    };

    createEffect(() => {
        setButtonTextAddress();
    });

    createEffect(() => {
        const addr = address();
        setAddressValid(addr !== undefined);
        setOnchainAddress(addr || "");
    });

    const { getSigner, hasMetamask } = useWeb3Signer();

    return (
        <>
            <Show when={hasMetamask()}>
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
            </Show>
            <Show when={!hasMetamask()}>
                <button class="btn" disabled>
                    {t("no_metamask")}
                </button>
            </Show>
        </>
    );
};

export default ConnectMetamask;
