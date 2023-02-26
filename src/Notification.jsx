import { createEffect } from "solid-js";
import { render } from "solid-js/web";
import { useI18n } from "@solid-primitives/i18n";

import { notification, setNotification, notificationType, setNotificationType } from "./signals";
import "./notification.css";

const Notification = () => {
  const [t, { add, locale, dict }] = useI18n();

  createEffect(() => {
      var new_notication = notification();
      if (new_notication) {
          var target = document.getElementById("notification")
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
