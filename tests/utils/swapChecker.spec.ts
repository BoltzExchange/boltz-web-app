import EventSource from "eventsource";
import { Server as HttpsServer, createServer } from "https";
import { AddressInfo } from "net";
import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { setSwapStatusAndClaim } from "../../src/helper";
import { setSwap, setSwaps } from "../../src/signals";
import { checkInterval, swapChecker } from "../../src/utils/swapChecker";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/utils/swapStatus";

global.EventSource = EventSource;

let apiUrl;

const fetcherCallData = [];

vi.mock("../../src/helper", async () => {
    return {
        isMobile: () => false,
        getApiUrl: () => apiUrl,
        fetcher: (_path, cb, data) => {
            fetcherCallData.push(data);
            cb();
        },
        setSwapStatusAndClaim: vi.fn(),
    };
});

class Server {
    public connectCount = 0;
    public connections = {};

    public address: string | undefined;
    private server: HttpsServer | undefined;

    public start = () => {
        this.server = createServer((req, res) => {
            this.connectCount += 1;
            const id = req.url.split("=")[1];
            this.connections[id] = res;

            res.on("close", () => {
                delete this.connections[id];
            });
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
        }).listen();
        this.address = `http://127.0.0.1:${
            (this.server.address() as AddressInfo).port
        }`;
    };

    public close = () => {
        this.server.close();
    };

    public sendMessage = (id: string, message: string) => {
        const con = this.connections[id];
        if (con === undefined) {
            throw "no connection for ID";
        }

        con.write(`data: ${message}\n\n`);
    };
}

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

describe("swapChecker", () => {
    const server = new Server();

    beforeEach(() => {
        server.start();
        vi.resetAllMocks();
        apiUrl = server.address;
    });

    afterEach(() => {
        clearInterval(checkInterval());
        server.close();
    });

    const swaps = [
        { id: "noStatus", asset: "BTC" },
        {
            id: "pending",
            asset: "BTC",
            status: swapStatusPending.TransactionMempool,
        },
        {
            id: "failed",
            asset: "BTC",
            status: swapStatusFailed.InvoiceFailedToPay,
        },
        {
            id: "success",
            asset: "BTC",
            status: swapStatusSuccess.InvoiceSettled,
        },
    ];

    test("should poll status of pending swaps", async () => {
        setSwaps(swaps);
        createRoot(() => {
            swapChecker();
        });
        await wait(100);

        expect(fetcherCallData).toHaveLength(2);
        expect(fetcherCallData).toEqual([
            {
                id: swaps[0].id,
            },
            {
                id: swaps[1].id,
            },
        ]);
    });

    test("should connect and handle SSE for active swap", async () => {
        createRoot(() => {
            swapChecker();
        });
        setSwap(swaps[0]);
        await wait();

        const message = { status: "some update" };
        server.sendMessage(swaps[0].id, JSON.stringify(message));
        await wait();

        expect(Object.keys(server.connections).length).toEqual(1);
        expect(server.connections[swaps[0].id]).not.toBeUndefined();

        expect(setSwapStatusAndClaim).toHaveBeenCalledTimes(3);
        expect(setSwapStatusAndClaim).toHaveBeenCalledWith(message, swaps[0]);
    });

    test("should close SSE when active swap changes", async () => {
        createRoot(() => {
            swapChecker();
        });
        setSwap(swaps[0]);
        await wait();

        expect(Object.keys(server.connections).length).toEqual(1);
        expect(server.connections[swaps[0].id]).not.toBeUndefined();

        setSwap(null);
        await wait();

        expect(Object.keys(server.connections).length).toEqual(0);
    });

    test("should not reconnect SSE when change swap has same id", async () => {
        setSwap(swaps[0]);
        await wait();

        const consCount = server.connectCount;

        setSwap({ id: swaps[0].id, some: "other data" });

        setSwap(swaps[0]);
        await wait();

        expect(server.connectCount).toEqual(consCount);
    });
});
