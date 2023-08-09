import log from "loglevel";
import { swapStatusFinal } from "./swapStatus";
import { setSwapStatusAndClaim, getApiUrl } from "../helper";

export const streams = {};

export const swapChecker = (swaps) => {
    swaps
        .map((swap) => [swap, swapStatusFinal.includes(swap.status)])
        .filter(([swap, isFinalized]) => {
            const hasStreamAlready = streams[swap.id] !== undefined;

            // Cleanup of streams for swaps that have finalized states
            if (hasStreamAlready && isFinalized) {
                log.debug("swap finalized; closing stream for:", swap.id);
                streams[swap.id].close();
                delete streams[swap.id];
            }

            return !hasStreamAlready;
        })
        .filter(([, isFinalized]) => !isFinalized)
        .forEach(([swap]) => {
            streams[swap.id] = handleStream(
                `${getApiUrl(swap.asset)}/streamswapstatus?id=${swap.id}`,
                (data) => {
                    setSwapStatusAndClaim(data, swap);
                }
            );
        });
};

const handleStream = (streamUrl, cb) => {
    let reconnectFrequencySeconds = 1;

    // Putting these functions in extra variables is just for the sake of readability
    const waitFunc = function () {
        return reconnectFrequencySeconds * 1000;
    };

    const tryToSetupFunc = function () {
        setupEventSource();
        reconnectFrequencySeconds *= 2;
        if (reconnectFrequencySeconds >= 64) {
            reconnectFrequencySeconds = 64;
        }
    };

    const reconnectFunc = function () {
        setTimeout(tryToSetupFunc, waitFunc());
    };

    function setupEventSource() {
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
    }

    return setupEventSource();
};
