import { Accessor, Show } from "solid-js";

import { useGlobalContext } from "../context/Global";

const RefundEta = ({
    timeoutEta,
    timeoutBlockHeight,
}: {
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
                <Show when={timeoutEta()}>
                    {t("timeout_eta")}: {getDateString(timeoutEta())} <br />
                </Show>
                {t("pay_timeout_blockheight")}: {timeoutBlockHeight()}
            </p>
        </div>
    );
};

export default RefundEta;
