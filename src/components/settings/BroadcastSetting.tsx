import { useGlobalContext } from "../../context/Global";

const BroadcastSetting = () => {
    const { externalBroadcast, setExternalBroadcast, t } = useGlobalContext();

    const toggle = (evt: MouseEvent) => {
        setExternalBroadcast(!externalBroadcast());
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="external-broadcast toggle"
                title={t("broadcast_setting_tooltip")}
                onClick={toggle}>
                <span class={externalBroadcast() ? "active" : ""}>
                    {t("on")}
                </span>
                <span class={!externalBroadcast() ? "active" : ""}>
                    {t("off")}
                </span>
            </div>
        </>
    );
};

export default BroadcastSetting;
