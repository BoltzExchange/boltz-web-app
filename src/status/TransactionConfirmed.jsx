import { useI18n } from "@solid-primitives/i18n";

const TransactionConfirmed = () => {
    const [t] = useI18n();

    return (
        <div>
          <h2>{t("tx_confirmed")}</h2>
          <p>{t("tx_ready_to_claim")}</p>
          <div class="spinner">
            <div class="bounce1"></div>
            <div class="bounce2"></div>
            <div class="bounce3"></div>
          </div>
        </div>
    );
};

export default TransactionConfirmed;
