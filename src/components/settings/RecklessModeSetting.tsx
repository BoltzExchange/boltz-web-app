import { useGlobalContext } from "../../context/Global";

const RecklessModeSetting = () => {
    const { t, isRecklessMode, setRecklessMode } = useGlobalContext();

    const toggle = (evt: MouseEvent) => {
        setRecklessMode(!isRecklessMode());
        evt.stopPropagation();
    };

    return (
        <>
            <div class="toggle" onClick={toggle}>
                <span class={isRecklessMode() ? "active" : ""}>{t("on")}</span>
                <span class={!isRecklessMode() ? "active" : ""}>
                    {t("off")}
                </span>
            </div>
        </>
    );
};

export default RecklessModeSetting;
