import LoadingSpinner from "../components/LoadingSpinner";
import t from "../i18n";

const InvoicePending = () => {
    return (
        <div>
            <p>{t("invoice_pending")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default InvoicePending;
