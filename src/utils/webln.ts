import log from "loglevel";

export function detectWebLNProvider(timeout: number = 3000) {
    const interval = 100;

    return new Promise((resolve) => {
        // @ts-ignore
        if (window.webln) {
            handleWebLn();
        } else {
            let i = 0;
            const checkInterval = setInterval(function () {
                // @ts-ignore
                if (window.webln || i >= timeout / interval) {
                    handleWebLn();
                    clearInterval(checkInterval);
                }
                i++;
            }, interval);
        }

        function handleWebLN() {
            // @ts-ignore
            resolve(window.webln !== undefined);
        }
    });
};

export async function enableWebln(cb: Function) {
    try {
        // @ts-ignore
        await window.webln.enable();
        await cb();
    } catch (error) {
        log.error("webln call failed", error);
    }
};
