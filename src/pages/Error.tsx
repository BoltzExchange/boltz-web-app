import { useGlobalContext } from "../context/Global";

const Error = () => {
    const { t } = useGlobalContext();
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
