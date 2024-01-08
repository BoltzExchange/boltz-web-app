import { render } from "@solidjs/testing-library";
import EventSource from "eventsource";
import { Server as HttpsServer, createServer } from "https";
import { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SwapChecker, checkInterval } from "../../src/components/SwapChecker";
import { GlobalProvider, useGlobalContext } from "../../src/context/Global";
import { PayProvider, usePayContext } from "../../src/context/Pay";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/utils/swapStatus";

global.EventSource = EventSource;

let apiUrl: string;

let fetcherCallData = [];
let claimData = [];

const swaps = [
    {
        id: "noStatus",
        asset: "BTC",
    },
    {
        id: "pending",
        asset: "BTC",
        status: swapStatusPending.TransactionMempool,
        transaction: "TXHEX",
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

vi.mock("../../src/utils/helper", async (importOriginal) => {
    const mod = await importOriginal<typeof import("../../src/utils/helper")>();
    return {
        ...mod,
        isMobile: () => false,
        getApiUrl: () => apiUrl,
        fetcher: (_path, _asset, cb, data) => {
            const status = swaps.find((s) => s.id === data.id).status;
            cb({ ...data, status: status, transaction: "mocked" });
            fetcherCallData.push(data);
        },
    };
});
vi.mock("../../src/utils/claim", async (importOriginal) => {
    const mod = await importOriginal<typeof import("../../src/utils/claim")>();
    return {
        ...mod,
        claim: (swap) => {
            claimData.push(swap);
        },
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

    let signals: any;
    let globalSignals: any;
    const TestComponent = () => {
        signals = usePayContext();
        globalSignals = useGlobalContext();
        return "";
    };

    beforeEach(() => {
        server.start();
        vi.resetAllMocks();
        apiUrl = server.address;
    });

    afterEach(() => {
        clearInterval(checkInterval());
        claimData = [];
        fetcherCallData = [];
        server.close();
    });

    test("should poll status of pending swaps", async () => {
        globalSignals.setSwaps(swaps);
        render(() => (
            <GlobalProvider>
                <PayProvider>
                    <TestComponent />
                    <SwapChecker />
                </PayProvider>
            </GlobalProvider>
        ));
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
        globalSignals.setSwaps(swaps);
        render(() => (
            <GlobalProvider>
                <PayProvider>
                    <TestComponent />
                    <SwapChecker />
                </PayProvider>
            </GlobalProvider>
        ));
        signals.setSwap(swaps[0]);
        await wait();

        const message = { status: "some update" };
        server.sendMessage(swaps[0].id, JSON.stringify(message));
        await wait();

        expect(Object.keys(server.connections).length).toEqual(1);
        expect(server.connections[swaps[0].id]).not.toBeUndefined();
        expect(claimData).toHaveLength(1);
        expect(claimData[0].id).toEqual("pending");
    });

    test("should close SSE when active swap changes", async () => {
        render(() => (
            <GlobalProvider>
                <PayProvider>
                    <TestComponent />
                    <SwapChecker />
                </PayProvider>
            </GlobalProvider>
        ));
        signals.setSwap(swaps[0]);
        await wait();

        expect(Object.keys(server.connections).length).toEqual(1);
        expect(server.connections[swaps[0].id]).not.toBeUndefined();

        signals.setSwap(null);
        await wait();

        expect(Object.keys(server.connections).length).toEqual(0);
    });

    test("should not reconnect SSE when change swap has same id", async () => {
        render(() => (
            <GlobalProvider>
                <PayProvider>
                    <TestComponent />
                    <SwapChecker />
                </PayProvider>
            </GlobalProvider>
        ));
        signals.setSwap(swaps[0]);
        await wait();

        const consCount = server.connectCount;

        signals.setSwap({ id: swaps[0].id, some: "other data" });

        signals.setSwap(swaps[0]);
        await wait();

        expect(server.connectCount).toEqual(consCount);
    });
});
