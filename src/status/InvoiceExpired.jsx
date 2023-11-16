import t from "../i18n";
import { useNavigate } from "@solidjs/router";

const InvoiceExpired = () => {
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
