import log from "loglevel";
import { createEffect, createSignal } from "solid-js";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { fetchLnurl } from "../utils/invoice";

type buttonLabelParams = {
    key: string;
    params?: Record<string, string>;
};

export const [buttonLabel, setButtonLabel] = createSignal<buttonLabelParams>({
    key: "create_swap",
});

export const CreateButton = () => {
    const { online, notify, t } = useGlobalContext();

    const {
        lnurl,
        receiveAmount,
        reverse,
        amountValid,
        setInvoice,
        setLnurl,
        valid,
        createSwap,
    } = useCreateContext();

    const [buttonDisable, setButtonDisable] = createSignal(true);
    const buttonClass = () => (!online() ? "btn btn-danger" : "btn");

    const validateButtonDisable = () => {
        return !valid() && !(lnurl() !== "" && amountValid());
    };

    createEffect(() => {
        setButtonDisable(validateButtonDisable());
    });

    createEffect(() => {
        if (valid()) {
            if (reverse() && lnurl()) {
                setButtonLabel({ key: "fetch_lnurl" });
            } else {
                setButtonLabel({ key: "create_swap" });
            }
        }
        if (!online()) {
            setButtonLabel({ key: "api_offline" });
        }
    });

    const buttonClick = async () => {
        if (amountValid() && !reverse() && lnurl() !== "") {
            try {
                const inv = await fetchLnurl(lnurl(), Number(receiveAmount()));
                setInvoice(inv);
                setLnurl("");
            } catch (e) {
                notify("error", e.message);
                log.warn("fetch lnurl failed", e);
            }
            return;
        }

        if (!valid()) return;
        setButtonDisable(true);
        await createSwap();
        setButtonDisable(validateButtonDisable());
    };

    return (
        <button
            id="create-swap-button"
            data-testid="create-swap-button"
            class={buttonClass()}
            disabled={buttonDisable() || !online()}
            onClick={buttonClick}>
            {t(buttonLabel().key, buttonLabel().params)}
        </button>
    );
};
