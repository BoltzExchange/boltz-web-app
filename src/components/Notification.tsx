import { createEffect } from "solid-js";

import {
    notification,
    notificationType,
    setNotification,
    setNotificationType,
} from "../signals";
import "../style/notification.scss";

const Notification = () => {
    createEffect(() => {
        var new_notication = notification();
        if (new_notication) {
            var target = document.getElementById("notification");
            target.classList.add("show");
            target.classList.add(notificationType());
            setTimeout(() => {
                target.classList.remove("show");
                target.classList.remove(notificationType());
                setNotification("");
                setNotificationType("");
            }, 4000);
        }
    });

    return (
        <div id="notification" class={notificationType()}>
            <span>{notification()}</span>
        </div>
    );
};

export default Notification;
