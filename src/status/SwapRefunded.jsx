import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { swap } from "../signals";
import BlockExplorer from "../components/BlockExplorer";

const SwapRefunded = () => {
    const [t] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <BlockExplorer isTxId={true} asset={swap().asset} address={swap().refundTx} />
            <hr />
            <span class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default SwapRefunded;
