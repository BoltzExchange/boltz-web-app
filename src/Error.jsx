import { useI18n } from "@solid-primitives/i18n";

const Error = () => {
    const [t] = useI18n();
    return (
        <div class="frame">
            <p style="font-size: 46px; margin:0;">⚠️</p>
            <hr />
            <h2>{t("error")}</h2>
            <p>{t("error_subline")}</p>
        </div>
    );
};
export default Error;
