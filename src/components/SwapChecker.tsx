import { OutputType } from "boltz-core";
import log from "loglevel";
import { createEffect, onCleanup, onMount } from "solid-js";

import { BTC, LBTC, RBTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    getReverseTransaction,
    getSubmarineTransaction,
} from "../utils/boltzClient";
import { claim, createSubmarineSignature } from "../utils/claim";
import { getApiUrl } from "../utils/helper";
import Lock from "../utils/lock";
import {
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../utils/swapStatus";

type SwapStatus = {
    id: string;
    status: string;
};

const reconnectInterval = 5_000;

class BoltzWebSocket {
    private readonly swapClaimLock = new Lock();

    private ws?: WebSocket;
    private reconnectTimeout?: any;
    private isClosed: boolean = false;

    constructor(
        private readonly url: string,
        private readonly relevantIds: Set<string>,
        private readonly prepareSwap: (id: string, status: any) => void,
        private readonly claimSwap: (id: string, status: any) => Promise<void>,
    ) {}

    public connect = () => {
        this.isClosed = false;
        clearTimeout(this.reconnectTimeout);
        this.ws?.close();
        this.ws = new WebSocket(
            `${BoltzWebSocket.formatWsUrl(this.url)}/v2/ws`,
        );

        this.ws.onopen = () => {
            this.subscribeUpdates(Array.from(this.relevantIds.values()));
        };
        this.ws.onclose = () => {
            log.warn(`ws ${this.url} closed`);
            this.handleClose();
        };
        this.ws.onmessage = async (msg) => {
            const data = JSON.parse(msg.data);
            if (data.event === "pong" || data.event === "ping") {
                return;
            }

            log.debug(`ws ${this.url} message`, data);

            if (data.event === "update" && data.channel === "swap.update") {
                const swapUpdates = data.args as SwapStatus[];
                for (const status of swapUpdates) {
                    this.relevantIds.add(status.id);
                    this.prepareSwap(status.id, status);
                    this.swapClaimLock.acquire(() =>
                        this.claimSwap(status.id, status),
                    );
                }
            }
        };
    };

    public close = () => {
        this.isClosed = true;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.ws?.close();
    };

    public subscribeUpdates = (ids: string[]) => {
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
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setTimeoutEta,
        setTimeoutBlockheight,
    } = usePayContext();
    const { notify, updateSwapStatus, swaps, setSwaps } = useGlobalContext();

    const assetWebsocket = new Map<string, BoltzWebSocket>();

    const checkForFailed = async (swap: any, data: any) => {
        if (
            data.status == "transaction.lockupFailed" ||
            data.status == "invoice.failedToPay"
        ) {
            const res = await getSubmarineTransaction(swap.asset, swap.id);
            if (swap.asset !== RBTC && !res.hex) {
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

    const prepareSwap = (swapId: string, data: any) => {
        const currentSwap = swaps().find((s: any) => swapId === s.id);
        if (currentSwap === undefined) {
            log.warn(`prepareSwap: swap ${swapId} not found`);
            return;
        }
        if (swap() && swap().id === currentSwap.id) {
            setSwapStatus(data.status);
        }
        if (data.transaction) setSwapStatusTransaction(data.transaction);
        if (data.status) updateSwapStatus(currentSwap.id, data.status);
        checkForFailed(currentSwap, data);
        if (data.failureReason) setFailureReason(data.failureReason);
    };

    const claimSwap = async (swapId: string, data: any) => {
        const currentSwap = swaps().find((s) => swapId === s.id);
        if (currentSwap === undefined) {
            log.warn(`claimSwap: swap ${swapId} not found`);
            return;
        }

        if (
            currentSwap.version !== OutputType.Taproot ||
            currentSwap.asset === RBTC
        ) {
            return;
        }

        if (data.status === swapStatusSuccess.InvoiceSettled) {
            data.transaction = await getReverseTransaction(
                currentSwap.asset,
                currentSwap.id,
            );
        }

        if (
            currentSwap.claimTx === undefined &&
            data.transaction !== undefined &&
            [
                swapStatusPending.TransactionConfirmed,
                swapStatusPending.TransactionMempool,
                swapStatusSuccess.InvoiceSettled,
            ].includes(data.status)
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

    onMount(() => {
        const urlsToAsset = new Map<string, string[]>();
        for (const [asset, url] of [BTC, LBTC, RBTC].map((asset) => [
            asset,
            getApiUrl(asset),
        ])) {
            urlsToAsset.set(url, (urlsToAsset.get(url) || []).concat(asset));
        }

        const swapsToCheck = swaps()
            .filter(
                (s) =>
                    !swapStatusFinal.includes(s.status) ||
                    (s.status === swapStatusSuccess.InvoiceSettled &&
                        s.claimTx === undefined),
            )
            .filter((s) => s.id !== swap()?.id);

        for (const [url, assets] of urlsToAsset.entries()) {
            log.debug(`opening ws for assets [${assets.join(", ")}]: ${url}`);
            const ws = new BoltzWebSocket(
                url,
                new Set<string>(
                    swapsToCheck
                        .filter((s) => assets.includes(s.asset))
                        .map((s) => s.id),
                ),
                prepareSwap,
                claimSwap,
            );
            ws.connect();
            for (const asset of assets) {
                assetWebsocket.set(asset, ws);
            }
        }
    });

    onCleanup(() => {
        const sockets = assetWebsocket.values();
        assetWebsocket.clear();

        for (const ws of sockets) {
            ws.close();
        }
    });

    createEffect(() => {
        const activeSwap = swap();
        if (activeSwap === undefined || activeSwap === null) {
            return;
        }
        const ws = assetWebsocket.get(activeSwap.asset);
        if (ws === undefined) {
            return;
        }

        ws.subscribeUpdates([activeSwap.id]);
    });

    return "";
};
