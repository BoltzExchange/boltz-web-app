import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const TransactionClaimed = () => {
    const [t] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
            <h2>{t("congrats")}</h2>
            <p>{t("successfully_swapped")}</p>
            <hr />
            <span class="btn" onClick={(e) => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default TransactionClaimed;
