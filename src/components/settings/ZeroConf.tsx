import { useGlobalContext } from "../../context/Global";

const ZeroConf = () => {
    const { zeroConf, setZeroConf, t } = useGlobalContext();

    const toggleZeroConf = (evt: MouseEvent) => {
        setZeroConf(!zeroConf());
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="toggle"
                data-testid="zero-conf-toggle"
                title={t("zero_conf_tooltip")}
                onClick={toggleZeroConf}>
                <span class={zeroConf() ? "active" : ""}>{t("on")}</span>
                <span class={!zeroConf() ? "active" : ""}>{t("off")}</span>
            </div>
        </>
    );
};

export default ZeroConf;
