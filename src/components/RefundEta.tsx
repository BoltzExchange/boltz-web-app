import t from "../i18n";
import { timeoutBlockHeight, timeoutEta } from "../signals";

const RefundEta = () => {
    return (
        <div>
            <h3>{t("refund_explainer")}</h3>
            <p>
                {t("timeout_eta")}: {new Date(timeoutEta()).toLocaleString()}{" "}
                <br />
                {t("pay_timeout_blockheight")}: {timeoutBlockHeight()}
            </p>
        </div>
    );
};

export default RefundEta;
