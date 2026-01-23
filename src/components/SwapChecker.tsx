import log from "loglevel";
import { createEffect, onCleanup, onMount } from "solid-js";
import { createStore } from "solid-js/store";

import { config } from "../config";
import { SwapType } from "../consts/Enums";
import {
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import type { SwapStatusTransaction } from "../context/Pay";
import { usePayContext } from "../context/Pay";
import { formatError } from "../utils/errors";
import { getApiUrl } from "../utils/helper";
import type { SomeSwap } from "../utils/swapCreator";

type SwapStatus = {
    id: string;
    status: string;

    failureReason?: string;
    transaction?: SwapStatusTransaction;
};

const reconnectInterval = 5_000;

class BoltzWebSocket {
    private ws?: WebSocket;
    private reconnectTimeout?: ReturnType<typeof setTimeout>;
    private isClosed: boolean = false;

    constructor(
        private readonly url: string,
        private readonly relevantIds: Set<string>,
        private readonly prepareSwap: (id: string, status: SwapStatus) => void,
        private readonly claimSwap: (
            id: string,
            status: SwapStatus,
        ) => Promise<void>,
    ) {}

    public connect = () => {
        log.debug("Opening WebSocket");
        void this.openWebSocket(`${this.url}/v2/ws`);
    };

    public close = () => {
        this.isClosed = true;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.ws?.close();
    };

    // "force" skips the check if we already subscribed to all the ids
    public subscribeUpdates = (ids: string[], force = false) => {
        if (!force && ids.every((id) => this.relevantIds.has(id))) {
            return;
        }

        ids.forEach((id) => this.relevantIds.add(id));
        if (this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                op: "subscribe",
                channel: "swap.update",
                args: ids,
            }),
        );
    };

    private openWebSocket = (url: string) => {
        this.isClosed = false;
        clearTimeout(this.reconnectTimeout);
        this.ws?.close();

        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket(BoltzWebSocket.formatWsUrl(url));

            this.ws.onopen = () => {
                this.subscribeUpdates(
                    Array.from(this.relevantIds.values()),
                    true,
                );
            };
            this.ws.onclose = (error) => {
                log.warn("WebSocket closed", error);
                this.handleClose();

                if (error.wasClean) {
                    resolve();
                } else {
                    reject(new Error(formatError(error)));
                }
            };
            this.ws.onmessage = async (msg) => {
                const data = JSON.parse(msg.data);
                if (data.event === "pong" || data.event === "ping") {
                    return;
                }

                log.debug(`WebSocket message:`, data);

                if (data.event === "update" && data.channel === "swap.update") {
                    const swapUpdates = data.args as SwapStatus[];
                    for (const status of swapUpdates) {
                        this.relevantIds.add(status.id);
                        this.prepareSwap(status.id, status);
                        await navigator.locks.request(
                            "swapCheckerClaim",
                            async () => {
                                await this.claimSwap(status.id, status);
                            },
                        );
                    }
                }
            };
        });
    };

    private handleClose = () => {
        // Don't reconnect when it has been closed manually
        if (this.isClosed) {
            return;
        }

        this.reconnectTimeout = setTimeout(
            () => this.connect(),
            reconnectInterval,
        );
    };

    private static formatWsUrl = (url: string) =>
        url.replace("http://", "ws://").replace("https://", "wss://");
}

export const SwapChecker = () => {
    const {
        swap,
        setSwap,
        claimSwap,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        shouldIgnoreBackendStatus,
    } = usePayContext();
    const { updateSwapStatus, getSwap, getSwaps } = useGlobalContext();

    let ws: BoltzWebSocket | undefined = undefined;

    const [pendingSwaps, setPendingSwaps] = createStore<string[]>([]);

    const updatePendingSwaps = (swap: SomeSwap, data: SwapStatus) => {
        if (![SwapType.Chain, SwapType.Reverse].includes(swap.type)) {
            return;
        }

        if (
            Object.values(swapStatusPending).includes(data.status) &&
            data.status !== swapStatusPending.SwapCreated &&
            !pendingSwaps.includes(swap.id)
        ) {
            setPendingSwaps((pendingSwaps) => [...pendingSwaps, swap.id]);
        }

        if (Object.values(swapStatusFinal).includes(data.status)) {
            setPendingSwaps((pendingSwaps) =>
                pendingSwaps.filter((id: string) => id !== swap.id),
            );
        }
    };

    const prepareSwap = async (swapId: string, data: SwapStatus) => {
        const currentSwap = await getSwap(swapId);
        if (currentSwap === null) {
            log.warn(`prepareSwap: swap ${swapId} not found`);
            return;
        }
        if (swap() && swap().id === currentSwap.id) {
            if (!shouldIgnoreBackendStatus()) {
                setSwapStatus(data.status);
                setSwap({ ...swap(), status: data.status });
            }
            if (data.transaction) {
                setSwapStatusTransaction(data.transaction);
            }
            if (data.failureReason) {
                setFailureReason(data.failureReason);
            }
        }
        if (data.status) {
            updatePendingSwaps(currentSwap, data);
            await updateSwapStatus(currentSwap.id, data.status);
        }
    };

    onMount(async () => {
        const swapsToCheck = (await getSwaps()).filter(
            (s) =>
                !swapStatusFinal.includes(s.status) ||
                ((s.status === swapStatusSuccess.InvoiceSettled ||
                    (s.type === SwapType.Chain &&
                        s.status === swapStatusSuccess.TransactionClaimed)) &&
                    s.claimTx === undefined),
        );

        ws = new BoltzWebSocket(
            getApiUrl(),
            new Set<string>(swapsToCheck.map((s) => s.id)),
            prepareSwap,
            claimSwap,
        );
        ws.connect();
    });

    onCleanup(() => {
        if (ws !== undefined) {
            ws.close();
        }
    });

    createEffect(() => {
        const activeSwap = swap();
        if (activeSwap === undefined || activeSwap === null) {
            return;
        }
        // on page reload assetWebsocket might not be initialized yet
        if (ws !== undefined) {
            ws.subscribeUpdates([activeSwap.id]);
        }
    });

    window.onbeforeunload = (event: BeforeUnloadEvent) => {
        if (config.preventReloadOnPendingSwaps && pendingSwaps?.length > 0) {
            event.preventDefault();
            return "";
        }
        return undefined;
    };

    return "";
};
