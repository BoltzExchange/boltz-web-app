import { Show } from "solid-js";

import t from "../i18n";
import { timeoutBlockHeight, timeoutEta } from "../signals";

const RefundEta = () => {
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
