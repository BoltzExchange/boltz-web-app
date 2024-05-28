import { useGlobalContext } from "../context/Global";
import Error from "./Error";

const ErrorWasm = () => {
    const { t } = useGlobalContext();

    return <Error error={t("error_wasm")} subline={t("wasm_not_supported")} />;
};

export default ErrorWasm;
