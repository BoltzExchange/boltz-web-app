import { useGlobalContext } from "../../context/Global";

const ZeroconfSetting = () => {
    const { zeroconf, setZeroconf, t } = useGlobalContext();

    const toggleZeroconf = (evt: MouseEvent) => {
        setZeroconf(!zeroconf());
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="zeroconf toggle"
                title={t("enable_zeroconf_tooltip")}
                onClick={toggleZeroconf}>
                <span class={zeroconf() ? "active" : ""}>{t("on")}</span>
                <span class={!zeroconf() ? "active" : ""}>{t("off")}</span>
            </div>
        </>
    );
};

export default ZeroconfSetting;
