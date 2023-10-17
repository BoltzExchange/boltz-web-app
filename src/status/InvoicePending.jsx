import t from "../i18n";
import LoadingSpinner from "../components/LoadingSpinner";

const InvoicePending = () => {
    return (
        <div>
            <p>{t("invoice_pending")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default InvoicePending;
