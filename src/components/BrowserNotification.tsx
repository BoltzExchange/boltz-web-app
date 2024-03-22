import { useGlobalContext } from "../context/Global";
import { registerNotifications } from "../utils/notification";

const BrowserNotification = () => {
    const { browserNotification, setBrowserNotification, t } =
        useGlobalContext();

    const toggle = (evt: MouseEvent) => {
        // if its false we try to enable it
        if (!browserNotification()) {
            registerNotifications().then((state: boolean) =>
                setBrowserNotification(state),
            );
            evt.stopPropagation();
            return;
        }
        // if its true we disable it
        setBrowserNotification(false);
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="browser-notification toggle"
                title={t("browsernotification_tooltip")}
                onClick={toggle}>
                <span class={browserNotification() ? "active" : ""}>
                    {t("on")}
                </span>
                <span class={!browserNotification() ? "active" : ""}>
                    {t("off")}
                </span>
            </div>
        </>
    );
};

export default BrowserNotification;
