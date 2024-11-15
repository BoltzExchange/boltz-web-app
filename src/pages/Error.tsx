import Warning from "../components/Warning";
import { useGlobalContext } from "../context/Global";

const Error = (props: { error?: string; subline?: string }) => {
    const { t } = useGlobalContext();
    return (
        <div class="frame">
            <Warning />
            <hr />
            <h2>{props.error || t("error")}</h2>
            <p>{props.subline || t("error_subline")}</p>
        </div>
    );
};

export default Error;
