import { useGlobalContext } from "../context/Global";

const Error = ({ error, subline }: { error?: string; subline?: string }) => {
    const { t } = useGlobalContext();
    return (
        <div class="frame">
            <p style="font-size: 46px; margin:0;">⚠️</p>
            <hr />
            <h2>{error || t("error")}</h2>
            <p>{subline || t("error_subline")}</p>
        </div>
    );
};

export default Error;
