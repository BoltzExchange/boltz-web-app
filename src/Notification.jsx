import { createEffect } from "solid-js";

import {
    notification,
    setNotification,
    notificationType,
    setNotificationType,
} from "./signals";
import "./css/notification.css";

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
            }, 2222);
        }
    });

    return (
        <div id="notification" class="notificationType()">
            <span>{notification()}</span>
        </div>
    );
};

export default Notification;
