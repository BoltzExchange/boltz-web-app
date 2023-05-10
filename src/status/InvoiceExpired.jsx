import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const InvoiceExpired = () => {
    const [t] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
            <p>{t("invoice_expired")}</p>
            <hr />
            <span class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default InvoiceExpired;
