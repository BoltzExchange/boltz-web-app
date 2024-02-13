import { useGlobalContext } from "../context/Global";

const ErrorWasm = () => {
    const { t } = useGlobalContext();
    return (
        <div class="frame">
            <p style="font-size: 46px; margin:0;">⚠️</p>
            <hr />
            <h2>{t("error_wasm")}</h2>
            <p>{t("wasm_not_supported")}</p>
        </div>
    );
};
export default ErrorWasm;
