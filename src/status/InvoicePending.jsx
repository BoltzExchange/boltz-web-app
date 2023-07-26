import { useI18n } from "@solid-primitives/i18n";
import LoadingSpinner from "../components/LoadingSpinner";

const InvoicePending = () => {
    const [t] = useI18n();

    return (
        <div>
            <p>{t("invoice_pending")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default InvoicePending;
