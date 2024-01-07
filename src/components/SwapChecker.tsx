import log from "loglevel";
import { createEffect, createSignal } from "solid-js";

import { RBTC } from "../consts";
import { usePayContext } from "../context/Pay";
import { setTimeoutBlockheight, setTimeoutEta, swaps } from "../signals";
import { claim, fetcher, getApiUrl } from "../utils/helper";
import {
    swapStatusFinal,
    swapStatusPending,
    updateSwapStatus,
} from "../utils/swapStatus";

export const [checkInterval, setCheckInterval] = createSignal<
    NodeJS.Timer | undefined
>(undefined);

export const SwapChecker = () => {
    const swapCheckInterval = 3000;

    const { swap, setSwapStatus, setSwapStatusTransaction, setFailureReason } =
        usePayContext();

    let activeStreamId = undefined;
    let activeSwapStream = undefined;

    const checkForFailed = (swap: any, data: any) => {
        if (
            data.status == "transaction.lockupFailed" ||
            data.status == "invoice.failedToPay"
        ) {
            const id = swap.id;

            fetcher(
                "/getswaptransaction",
                swap.asset,
                (data: any) => {
                    if (swap.asset !== RBTC && !data.transactionHex) {
                        log.error("no mempool tx found");
                    }
                    if (!data.timeoutEta) {
                        log.error("no timeout eta");
                    }
                    if (!data.timeoutBlockHeight) {
                        log.error("no timeout blockheight");
                    }
                    const timestamp = data.timeoutEta * 1000;
                    const eta = new Date(timestamp);
                    log.debug(
                        "Timeout ETA: \n " + eta.toLocaleString(),
                        timestamp,
                    );
                    setTimeoutEta(timestamp);
                    setTimeoutBlockheight(data.timeoutBlockHeight);
                },
                {
                    id,
                },
            );
        }
    };

    const setSwapStatusAndClaim = (data: any, activeSwap: any) => {
        const currentSwap = swaps().find((s) => activeSwap.id === s.id);
        if (swap() && swap().id === currentSwap.id) {
            setSwapStatus(data.status);
        }

        if (data.transaction) setSwapStatusTransaction(data.transaction);
        if (data.status) updateSwapStatus(currentSwap.id, data.status);

        if (
            currentSwap.claimTx === undefined &&
            data.transaction !== undefined &&
            (data.status === swapStatusPending.TransactionConfirmed ||
                data.status === swapStatusPending.TransactionMempool)
        ) {
            claim(currentSwap, data.transaction);
        }
        checkForFailed(currentSwap, data);
        if (data.failureReason) setFailureReason(data.failureReason);
    };

    const runSwapCheck = async () => {
        const swapsToCheck = swaps()
            .filter((s) => !swapStatusFinal.includes(s.status))
            .filter((s) => s.id !== swap()?.id);

        for (const swap of swapsToCheck) {
            await new Promise<void>((resolve) => {
                fetcher(
                    "/swapstatus",
                    swap.asset,
                    (data: any) => {
                        setSwapStatusAndClaim(data, swap);
                        resolve();
                    },
                    { id: swap.id },
                );
            });
        }
    };

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

    return "";
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
