import { useNavigate } from "@solidjs/router";

import { useGlobalContext } from "../context/Global";

const TransactionClaimed = () => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();

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
