import { OutputType } from "boltz-core";
import log from "loglevel";
import { createEffect, onCleanup, onMount } from "solid-js";
import { createStore } from "solid-js/store";

import { BTC, LBTC, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import {
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import type { SwapStatusTransaction } from "../context/Pay";
import { usePayContext } from "../context/Pay";
import {
    getChainSwapTransactions,
    getReverseTransaction,
    postChainSwapDetails,
} from "../utils/boltzClient";
import {
    claim,
    createSubmarineSignature,
    createTheirPartialChainSwapSignature,
} from "../utils/claim";
import { formatError } from "../utils/errors";
import { getApiUrl, getPair } from "../utils/helper";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "../utils/swapCreator";
import { getRelevantAssetForSwap } from "../utils/swapCreator";

type SwapStatus = {
    id: string;
    status: string;

    failureReason?: string;
    transaction?: SwapStatusTransaction;
};

const coopClaimableSymbols = [BTC, LBTC];

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
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
    } = usePayContext();
    const {
        notify,
        updateSwapStatus,
        getSwap,
        getSwaps,
        setSwapStorage,
        externalBroadcast,
        t,
        deriveKey,
        pairs,
    } = useGlobalContext();

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
            setSwapStatus(data.status);
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

    const claimSwap = async (swapId: string, data: SwapStatus) => {
        const currentSwap = await getSwap(swapId);
        if (currentSwap === null) {
            log.warn(`claimSwap: swap ${swapId} not found`);
            return;
        }

        if (
            currentSwap.type === SwapType.Chain &&
            data.status === swapStatusPending.TransactionClaimPending &&
            coopClaimableSymbols.includes((currentSwap as ChainSwap).assetSend)
        ) {
            await helpServerClaim(currentSwap as ChainSwap);
            return;
        }

        if (getRelevantAssetForSwap(currentSwap) === RBTC) {
            if (
                data.status === swapStatusPending.TransactionMempool &&
                data.transaction !== undefined
            ) {
                currentSwap.lockupTx = data.transaction.id;
                await setSwapStorage(currentSwap);
            }

            return;
        }

        if (currentSwap.version !== OutputType.Taproot) {
            return;
        }

        if (data.status === swapStatusSuccess.InvoiceSettled) {
            data.transaction = await getReverseTransaction(currentSwap.id);
        } else if (
            currentSwap.type === SwapType.Chain &&
            data.status === swapStatusSuccess.TransactionClaimed
        ) {
            data.transaction = (
                await getChainSwapTransactions(currentSwap.id)
            ).serverLock.transaction;
        }

        if (
            currentSwap.claimTx === undefined &&
            data.transaction !== undefined &&
            ((currentSwap.type === SwapType.Reverse &&
                [
                    swapStatusPending.TransactionConfirmed,
                    swapStatusPending.TransactionMempool,
                    swapStatusSuccess.InvoiceSettled,
                ].includes(data.status)) ||
                (currentSwap.type === SwapType.Chain &&
                    [
                        swapStatusSuccess.TransactionClaimed,
                        swapStatusPending.TransactionServerConfirmed,
                        swapStatusPending.TransactionServerMempool,
                    ].includes(data.status)))
        ) {
            try {
                const res = await claim(
                    deriveKey,
                    currentSwap as ReverseSwap | ChainSwap,
                    data.transaction as { hex: string },
                    true,
                    externalBroadcast(),
                );
                const claimedSwap = await getSwap(res.id);
                claimedSwap.claimTx = res.claimTx;
                await setSwapStorage(claimedSwap);

                if (claimedSwap.id === swap().id) {
                    setSwap(claimedSwap);
                }
                notify(
                    "success",
                    t("swap_completed", { id: res.id }),
                    true,
                    true,
                );
            } catch (e) {
                const msg = t("claim_fail", { id: currentSwap.id });
                log.warn(msg, e);
                notify("error", msg);
            }
        } else if (
            currentSwap.type === SwapType.Submarine &&
            data.status === swapStatusPending.TransactionClaimPending &&
            currentSwap.receiveAmount >=
                getPair(
                    pairs(),
                    currentSwap.type,
                    currentSwap.assetSend,
                    currentSwap.assetReceive,
                ).limits.minimal
        ) {
            try {
                await createSubmarineSignature(
                    deriveKey,
                    currentSwap as SubmarineSwap,
                );
                notify(
                    "success",
                    t("swap_completed", { id: currentSwap.id }),
                    true,
                    true,
                );
            } catch (e) {
                if (e === "swap not eligible for a cooperative claim") {
                    log.debug(
                        `Server did not want help claiming ${currentSwap.id}`,
                    );
                    return;
                }

                const msg =
                    "creating cooperative signature for submarine swap claim failed";
                log.warn(msg, e);
                notify("error", msg);
            }
        }
    };

    const helpServerClaim = async (swap: ChainSwap) => {
        if (swap.claimTx === undefined) {
            log.warn(
                `Not helping server claim Chain Swap ${swap.id} because we have not claimed yet`,
            );
            return;
        }

        try {
            log.debug(
                `Helping server claim ${swap.assetSend} of Chain Swap ${swap.id}`,
            );
            const sig = await createTheirPartialChainSwapSignature(
                deriveKey,
                swap,
            );
            await postChainSwapDetails(swap.id, undefined, sig);
        } catch (e) {
            log.warn(
                `Helping server claim Chain Swap ${swap.id} failed: ${formatError(e)}`,
            );
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
        if (pendingSwaps?.length > 0) {
            event.preventDefault();
            return "";
        }
        return undefined;
    };

    return "";
};
