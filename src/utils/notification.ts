import log from "loglevel";

export const registerNotifications = () => {
    return new Promise((resolve) => {
        Notification.requestPermission().then((result) => {
            log.info("Notification permission: ", result);
            resolve(result === "granted");
        });
    });
};
