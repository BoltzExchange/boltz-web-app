import { useNavigate } from "@solidjs/router";
import type { Accessor } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const SwapExpired = () => {
    const navigate = useNavigate();
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <div>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <RefundButton swap={swap as Accessor<SubmarineSwap | ChainSwap>} />
            <hr />
            <button class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </button>
        </div>
    );
};

export default SwapExpired;
