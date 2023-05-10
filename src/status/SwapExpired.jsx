import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import { failureReason, setRefundAddress, swap } from "../signals";
import { refund } from "../helper";

const SwapExpired = () => {
    const [t, { add, locale, dict }] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
            <p>
                {t("lockup_failed_reason")}: {failureReason()}
            </p>
            <hr />
            <input
                onKeyUp={(e) => setRefundAddress(e.currentTarget.value)}
                onChange={(e) => setRefundAddress(e.currentTarget.value)}
                type="text"
                id="refundAddress"
                name="refundAddress"
                placeholder={t("refund_address_placeholder")}
            />
            <span class="btn" onclick={() => refund(swap())}>
                {t("refund")}
            </span>
            <hr />
            <span class="btn" onClick={(e) => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default SwapExpired;
