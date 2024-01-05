import log from "loglevel";
import { createEffect, createSignal } from "solid-js";

import { swap, swaps } from "../signals";
import { fetcher, getApiUrl, setSwapStatusAndClaim } from "./helper";
import { swapStatusFinal } from "./swapStatus";

const swapCheckInterval = 3000;

let activeStreamId = undefined;
let activeSwapStream = undefined;

export const [checkInterval, setCheckInterval] = createSignal<
    NodeJS.Timer | undefined
>(undefined);

export const swapChecker = () => {
    createEffect(() => {
        const activeSwap = swap();
        if (swap()?.id === activeStreamId) {
            return;
        }

        if (activeSwapStream !== undefined) {
            activeSwapStream.close();
            activeSwapStream = undefined;
            activeStreamId = undefined;
        }

        if (activeSwap === null) {
            return;
        }

        log.debug(`subscribing to SSE of swap`, activeSwap.id);
        activeStreamId = activeSwap.id;
        activeSwapStream = handleStream(
            `${getApiUrl(activeSwap.asset)}/streamswapstatus?id=${
                activeSwap.id
            }`,
            (data) => {
                setSwapStatusAndClaim(data, activeSwap);
            },
        );
    });

    let checkRunning = false;

    if (checkInterval() !== undefined) {
        clearInterval(checkInterval());
    }

    runSwapCheck().then();

    setCheckInterval(
        setInterval(async () => {
            if (checkRunning) {
                return;
            }

            checkRunning = true;
            try {
                await runSwapCheck();
            } catch (e) {
                log.error("swap update check failed", e);
            }

            checkRunning = false;
        }, swapCheckInterval),
    );
};

const runSwapCheck = async () => {
    const swapsToCheck = swaps()
        .filter((s) => !swapStatusFinal.includes(s.status))
        .filter((s) => s.id !== swap()?.id);

    for (const swap of swapsToCheck) {
        await new Promise<void>((resolve) => {
            fetcher(
                "/swapstatus",
                (data) => {
                    setSwapStatusAndClaim(data, swap);
                    resolve();
                },
                { id: swap.id },
            );
        });
    }
};

const handleStream = (streamUrl: string, cb: (data: any) => void) => {
    let reconnectFrequencySeconds = 1;

    // Putting these functions in extra variables is just for the sake of readability
    const waitFunc = () => {
        return reconnectFrequencySeconds * 1000;
    };

    const tryToSetupFunc = () => {
        setupEventSource();
        reconnectFrequencySeconds *= 2;
        if (reconnectFrequencySeconds >= 64) {
            reconnectFrequencySeconds = 64;
        }
    };

    const reconnectFunc = () => {
        setTimeout(tryToSetupFunc, waitFunc());
    };

    const setupEventSource = () => {
        let stream = new EventSource(streamUrl);
        log.debug(`stream started: ${streamUrl}`);
        stream.onmessage = function (event) {
            const data = JSON.parse(event.data);
            log.debug(`stream status update: ${data.status}`, data);
            cb(data);
        };
        stream.onopen = function () {
            reconnectFrequencySeconds = 1;
        };
        stream.onerror = function (e) {
            log.debug("stream error", e);
            stream.close();
            reconnectFunc();
        };
        return stream;
    };

    return setupEventSource();
};
