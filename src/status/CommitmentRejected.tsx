import type { Accessor } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const CommitmentRejected = () => {
    const { swap } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <div>
            <p>{t("commitment_rejected_line")}</p>
            <hr />
            <RefundButton swap={swap as Accessor<SubmarineSwap | ChainSwap>} />
        </div>
    );
};

export default CommitmentRejected;
