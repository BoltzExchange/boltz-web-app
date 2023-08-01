import log from "loglevel";

export function detectWebLNProvider(timeoutParam) {
    const timeout = timeoutParam ?? 3000;
    const interval = 100;

    return new Promise((resolve) => {
        if (window.webln) {
            handleWebLN();
        } else {
            let i = 0;
            const checkInterval = setInterval(function () {
                if (window.webln || i >= timeout / interval) {
                    handleWebLN();
                    clearInterval(checkInterval);
                }
                i++;
            }, interval);
        }

        function handleWebLN() {
            resolve(window.webln !== undefined);
        }
    });
}

export async function enableWebln(cb) {
    try {
        await window.webln.enable();
        await cb();
    } catch (error) {
        log.error("webln call failed", error);
    }
}
