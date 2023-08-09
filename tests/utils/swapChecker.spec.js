import { createServer } from "https";
import EventSource from "eventsource";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setSwapStatusAndClaim } from "../../src/helper";
import { streams, swapChecker } from "../../src/utils/swapChecker";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/utils/swapStatus";

global.EventSource = EventSource;

let apiUrl;

vi.mock("../../src/helper", async () => {
    return {
        isMobile: () => false,
        getApiUrl: () => apiUrl,
        setSwapStatusAndClaim: vi.fn(),
    };
});

class Sse {
    connections = {};

    start() {
        this.server = createServer((req, res) => {
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
        this.address = `http://127.0.0.1:${this.server.address().port}`;
    }

    close() {
        this.server.close();
    }

    sendMessage(id, message) {
        const con = this.connections[id];
        if (con === undefined) {
            throw "no connection for ID";
        }

        con.write(`data: ${message}\n\n`);
    }
}

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

describe("swapChecker", () => {
    const sse = new Sse();

    beforeAll(() => {
        sse.start();
        apiUrl = sse.address;
    });

    afterAll(() => {
        sse.close();
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

    test("should open streams for non final swaps", async () => {
        swapChecker(swaps);
        await wait();

        expect(Object.keys(sse.connections).length).toEqual(2);
        expect(sse.connections[swaps[0].id]).not.toBeUndefined();
        expect(sse.connections[swaps[1].id]).not.toBeUndefined();

        expect(Object.keys(streams).length).toEqual(2);
        expect(streams[swaps[0].id]).not.toBeUndefined();
        expect(streams[swaps[1].id]).not.toBeUndefined();
    });

    test("should not open streams multiple times", async () => {
        const realCons = sse.connections;
        sse.connections = {};

        swapChecker(swaps);
        await wait();

        expect(Object.keys(sse.connections).length).toEqual(0);

        sse.connections = realCons;
    });

    test("should close stream after swap status becomes final", async () => {
        swaps[1].status = swapStatusSuccess.InvoiceSettled;

        swapChecker(swaps);
        await wait();

        expect(Object.keys(sse.connections).length).toEqual(1);
        expect(sse.connections[swaps[0].id]).not.toBeUndefined();
        expect(sse.connections[swaps[1].id]).toBeUndefined();

        expect(Object.keys(streams).length).toEqual(1);
        expect(streams[swaps[0].id]).not.toBeUndefined();
        expect(streams[swaps[1].id]).toBeUndefined();
    });

    test("should callback after message", async () => {
        const message = { status: "some update" };
        sse.sendMessage(swaps[0].id, JSON.stringify(message));
        await wait();

        expect(setSwapStatusAndClaim).toHaveBeenCalledTimes(1);
        expect(setSwapStatusAndClaim).toHaveBeenCalledWith(message, swaps[0]);
    });
});
