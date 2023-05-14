import { useI18n } from "@solid-primitives/i18n";

const InvoicePending = () => {
    const [t] = useI18n();

    return (
        <div>
            <p>{t("invoice_pending")}</p>
            <div class="spinner">
                <div class="bounce1"></div>
                <div class="bounce2"></div>
                <div class="bounce3"></div>
            </div>
        </div>
    );
};

export default InvoicePending;
