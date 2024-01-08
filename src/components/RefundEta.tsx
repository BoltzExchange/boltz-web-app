import { Show } from "solid-js";

import { usePayContext } from "../context/Pay";
import t from "../i18n";

const RefundEta = () => {
    const { timeoutEta, timeoutBlockHeight } = usePayContext();
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
