import { useGlobalContext } from "../context/Global";
import { registerNotifications } from "../utils/notification";

const BrowserNotification = () => {
    const { browserNotification, setBrowserNotification, t, notify } =
        useGlobalContext();

    const toggle = (evt: MouseEvent) => {
        // When disabled, we try to request permission and enable them
        if (!browserNotification()) {
            registerNotifications().then((state: boolean) => {
                setBrowserNotification(state);
                if (state === false) {
                    notify("error", t("browsernotification_error"));
                }
            });
            evt.stopPropagation();
            return;
        }
        // When enabled, we disable sending them
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
