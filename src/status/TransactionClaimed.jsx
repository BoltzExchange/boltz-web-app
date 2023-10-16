import { useNavigate } from "@solidjs/router";
import t from "../i18n";

const TransactionClaimed = () => {
    const navigate = useNavigate();

    return (
        <div>
            <h2>{t("congrats")}</h2>
            <p>{t("successfully_swapped")}</p>
            <hr />
            <span class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default TransactionClaimed;
