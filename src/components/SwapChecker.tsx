import log from "loglevel";
import { createEffect, createSignal } from "solid-js";

import { RBTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { claim, createSubmarineSignature } from "../utils/claim";
import { fetcher, getApiUrl } from "../utils/helper";
import { swapStatusFinal, swapStatusPending } from "../utils/swapStatus";

export const [checkInterval, setCheckInterval] = createSignal<
    NodeJS.Timer | undefined
>(undefined);

export const swapCheckInterval = 3000;
export const SwapChecker = () => {
    const {
        swap,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setTimeoutEta,
        setTimeoutBlockheight,
    } = usePayContext();
    const { notify, updateSwapStatus, swaps, setSwaps } = useGlobalContext();

    let activeStreamId = undefined;
    let activeSwapStream = undefined;

    const checkForFailed = async (swap: any, data: any) => {
        if (
            data.status == "transaction.lockupFailed" ||
            data.status == "invoice.failedToPay"
        ) {
            const id = swap.id;
            const res = await fetcher("/getswaptransaction", swap.asset, {
                id,
            });
            if (swap.asset !== RBTC && !res.transactionHex) {
                log.error("no mempool tx found");
            }
            if (!res.timeoutEta) {
                log.error("no timeout eta");
            }
            if (!res.timeoutBlockHeight) {
                log.error("no timeout blockheight");
            }
            const timestamp = res.timeoutEta * 1000;
            const eta = new Date(timestamp);
            log.debug("Timeout ETA: \n " + eta.toLocaleString(), timestamp);
            setTimeoutEta(timestamp);
            setTimeoutBlockheight(res.timeoutBlockHeight);
        }
    };

    const prepareSwap = (data: any, activeSwap: any) => {
        const currentSwap = swaps().find((s) => activeSwap.id === s.id);
        if (swap() && swap().id === currentSwap.id) {
            setSwapStatus(data.status);
        }
        if (data.transaction) setSwapStatusTransaction(data.transaction);
        if (data.status) updateSwapStatus(currentSwap.id, data.status);
        checkForFailed(currentSwap, data);
        if (data.failureReason) setFailureReason(data.failureReason);
    };

    const claimSwap = async (data: any, activeSwap: any) => {
        const currentSwap = swaps().find((s) => activeSwap.id === s.id);
        if (
            currentSwap.claimTx === undefined &&
            data.transaction !== undefined &&
            (data.status === swapStatusPending.TransactionConfirmed ||
                data.status === swapStatusPending.TransactionMempool)
        ) {
            try {
                const res = await claim(currentSwap, data.transaction);
                const swapsTmp = swaps();
                const claimedSwap = swapsTmp.find((s) => res.id === s.id);
                claimedSwap.claimTx = res.claimTx;
                setSwaps(swapsTmp);
                notify("success", `swap ${res.id} claimed`);
            } catch (e) {
                log.warn("swapchecker failed to claim swap", e);
            }
        } else if (data.status === swapStatusPending.TransactionClaimPending) {
            try {
                await createSubmarineSignature(currentSwap);
            } catch (e) {
                log.warn(
                    "swapchecker failed to sign cooperative submarine claim",
                    e,
                );
            }
        }
    };

    const runSwapCheck = async () => {
        const swapsToCheck = swaps()
            .filter((s) => !swapStatusFinal.includes(s.status))
            .filter((s) => s.id !== swap()?.id);

        for (const swap of swapsToCheck) {
            try {
                const res = await fetcher("/swapstatus", swap.asset, {
                    id: swap.id,
                });
                await claimSwap(res, swap);
            } catch (e) {
                log.debug("swapchecker failed to claim swap", e);
            }
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
            async (data) => {
                prepareSwap(data, activeSwap);
                await claimSwap(data, activeSwap);
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
