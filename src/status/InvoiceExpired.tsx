import { useNavigate } from "@solidjs/router";

import { useGlobalContext } from "../context/Global";

const InvoiceExpired = () => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();

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
