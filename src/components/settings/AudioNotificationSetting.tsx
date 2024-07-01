import { useGlobalContext } from "../../context/Global";

const AudioNotificationSetting = () => {
    const {
        audioNotification,
        setAudioNotification,
        t,
        playNotificationSound,
    } = useGlobalContext();

    const toggleAudioNotification = (evt: MouseEvent) => {
        if (!audioNotification()) playNotificationSound();
        setAudioNotification(!audioNotification());
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="audio toggle"
                title={t("enable_audio_tooltip")}
                onClick={toggleAudioNotification}>
                <span class={audioNotification() ? "active" : ""}>
                    {t("on")}
                </span>
                <span class={!audioNotification() ? "active" : ""}>
                    {t("off")}
                </span>
            </div>
        </>
    );
};

export default AudioNotificationSetting;
