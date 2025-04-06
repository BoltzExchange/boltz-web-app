import type { Accessor } from "solid-js";
import { Show } from "solid-js";

import { useGlobalContext } from "../context/Global";

const RefundEta = (props: {
    timeoutEta: Accessor<number>;
    timeoutBlockHeight: Accessor<number>;
}) => {
    const { t } = useGlobalContext();
    const getDateString = (timestamp: number) =>
        new Date(timestamp * 1000).toLocaleString();
    return (
        <div>
            <h3>{t("refund_explainer")}</h3>
            <p>
                <Show when={props.timeoutEta()}>
                    {t("timeout_eta")}: {getDateString(props.timeoutEta())}{" "}
                    <br />
                </Show>
                {t("pay_timeout_blockheight")}: {props.timeoutBlockHeight()}
            </p>
        </div>
    );
};

export default RefundEta;
