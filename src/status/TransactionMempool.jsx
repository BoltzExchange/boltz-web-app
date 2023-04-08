import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const TransactionMempool = () => {
    const [t, { add, locale, dict }] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
          <h2>{t("tx_in_mempool")}</h2>
          <p>{t("tx_in_mempool_subline")}</p>
          <div class="spinner">
            <div class="bounce1"></div>
            <div class="bounce2"></div>
            <div class="bounce3"></div>
          </div>
        </div>
    );
};

export default TransactionMempool;
