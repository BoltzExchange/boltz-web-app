import { useGlobalContext } from "../context/Global";

const Separator = () => {
    const { separator, setSeparator } = useGlobalContext();

    const toggleSeparator = (evt: MouseEvent) => {
        setSeparator(separator() === "." ? "," : ".");
        evt.stopPropagation();
    };

    return (
        <div class="separator toggle" onClick={toggleSeparator}>
            <span class={separator() === "." ? "active" : ""}>.</span>
            <span class={separator() === "," ? "active" : ""}>,</span>
        </div>
    );
};

export default Separator;
