import log from "loglevel";

export const registerNotifications = () => {
    return new Promise<boolean>((resolve) => {
        Notification.requestPermission().then((result) => {
            log.info("Notification permission: ", result);
            resolve(result === "granted");
        });
    });
};
