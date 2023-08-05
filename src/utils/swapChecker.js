import log from "loglevel";
import { api_url } from "../config";
import { setSwapStatusAndClaim } from "../helper";
import { swapStatusFinal } from "./swapStatus";

let streams = {};

export const swapChecker = (swaps) => {
    swaps.forEach((swap) => {
        if (Object.keys(streams).indexOf(swap.id) !== -1) {
            // stream already open for this swap
            if (swapStatusFinal.includes(swap.status)) {
                log.debug("stream: swap finalized closing stream.", swap.id);
                streams[swap.id].close();
                delete streams[swap.id];
            }
            return;
        }
        // if swap is already finalized, we don't need to open a stream
        if (swapStatusFinal.includes(swap.status)) {
            return;
        }
        streams[swap.id] = handleStream(
            `${api_url}/streamswapstatus?id=${swap.id}`,
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
            log.debug(`Event status update: ${data.status}`, data);
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
