import log from "loglevel";

export const detectWebLNProvider = (timeout: number = 3000) => {
    const interval = 100;

    return new Promise((resolve) => {
        const handleWebLn = () => {
            resolve(window.webln !== undefined);
        };

        if (window.webln) {
            handleWebLn();
        } else {
            let i = 0;
            const checkInterval = setInterval(function () {
                if (window.webln || i >= timeout / interval) {
                    handleWebLn();
                    clearInterval(checkInterval);
                }
                i++;
            }, interval);
        }
    });
};

export const enableWebln = async (
    cb: () => Promise<void> | void,
): Promise<void> => {
    try {
        await window.webln.enable();
        await cb();
    } catch (error) {
        log.error("webln call failed", error);
    }
};
