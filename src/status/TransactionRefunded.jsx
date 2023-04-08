import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const TransactionRefunded = () => {
    const [t, { add, locale, dict }] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
          <h2>{t("transaction_refunded")}</h2>
          <hr />
          <span class="btn" onClick={(e) => navigate("/swap")}>{t("new_swap")}</span>
        </div>
    );
};

export default TransactionRefunded;
