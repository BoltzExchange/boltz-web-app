import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";

const InvoicePending = () => {
    const { t } = useGlobalContext();
    return (
        <div>
            <p>{t(config.isPro ? "invoice_pending_pro" : "invoice_pending")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default InvoicePending;
