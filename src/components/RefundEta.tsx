import { Show } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const RefundEta = () => {
    const { timeoutEta, timeoutBlockHeight } = usePayContext();
    const { t } = useGlobalContext();
    return (
        <Show when={timeoutEta()}>
            <div>
                <h3>{t("refund_explainer")}</h3>
                <p>
                    {t("timeout_eta")}:{" "}
                    {new Date(timeoutEta()).toLocaleString()} <br />
                    {t("pay_timeout_blockheight")}: {timeoutBlockHeight()}
                </p>
            </div>
        </Show>
    );
};

export default RefundEta;
