import { createEffect, on } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/notification.scss";

const Notification = () => {
    let notificationRef: HTMLDivElement;
    const {
        notification,
        setNotification,
        notificationType,
        setNotificationType,
    } = useGlobalContext();

    createEffect(
        on([notification], () => {
            const new_notication = notification();
            if (new_notication) {
                notificationRef.classList.add("show");
                notificationRef.classList.add(notificationType());
                setTimeout(() => {
                    notificationRef.classList.remove("show");
                    notificationRef.classList.remove(notificationType());
                    setNotification("");
                    setNotificationType("");
                }, 4000);
            }
        }),
    );

    return (
        <div ref={notificationRef} id="notification">
            <span>{notification()}</span>
        </div>
    );
};

export default Notification;
