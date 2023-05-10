import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import { swap, denomination } from "../signals";
import { formatAmount } from "../utils/denomination";

const TransactionClaimed = () => {
    const [t] = useI18n();

    const navigate = useNavigate();
    const curSwap = swap();

    return (
        <div>
            <h2>{t("congrats")}</h2>
            <p>
                {t("successfully_swapped", {
                    amount: formatAmount(
                        curSwap.expectedAmount | curSwap.onchainAmount
                    ),
                    denomination: denomination(),
                })}
            </p>
            <hr />
            <span class="btn" onClick={(e) => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default TransactionClaimed;
