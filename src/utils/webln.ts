import type { WebLNProvider } from "@webbtc/webln-types";
import log from "loglevel";

type WebLNCallback = () => Promise<void> | void;

const getWebln = (): WebLNProvider | undefined =>
    (globalThis as { webln?: WebLNProvider }).webln;

export const detectWebLNProvider = (
    timeoutMs: number = 3000,
): Promise<boolean> => {
    if (getWebln() !== undefined) {
        return Promise.resolve(true);
    }

    const interval = 100;
    return new Promise((resolve) => {
        let elapsed = 0;
        const handle = setInterval(() => {
            elapsed += interval;
            if (getWebln() !== undefined || elapsed >= timeoutMs) {
                clearInterval(handle);
                resolve(getWebln() !== undefined);
            }
        }, interval);
    });
};

export const enableWebln = async (cb: WebLNCallback): Promise<void> => {
    try {
        const webln = getWebln();
        if (webln !== undefined) {
            await webln.enable();
        }
        await cb();
    } catch (error) {
        log.error("webln call failed", error);
    }
};
