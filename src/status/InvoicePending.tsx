import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";

const InvoicePending = () => {
    const { t } = useGlobalContext();
    return (
        <div>
            <p>{t("invoice_pending")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default InvoicePending;
