import { useGlobalContext } from "../../context/Global";

const Separator = () => {
    const { separator, setSeparator, t } = useGlobalContext();

    const toggle = () => {
        setSeparator(separator() === "." ? "," : ".");
    };

    return (
        <div
            class="separator toggle"
            title={t("separator_tooltip")}
            onClick={toggle}>
            <span class={separator() === "." ? "active" : ""}>.</span>
            <span class={separator() === "," ? "active" : ""}>,</span>
        </div>
    );
};

export default Separator;
