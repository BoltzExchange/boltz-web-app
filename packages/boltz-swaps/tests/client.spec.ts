import {
    createChainSwap,
    createReverseSwap,
    createSubmarineSwap,
    getSwapStatuses,
    patchSwapMetadata,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "boltz-swaps/client";

import type * as FetcherModule from "../src/http/fetcher.ts";

const { fetcherMock } = vi.hoisted(() => ({
    fetcherMock: vi.fn(),
}));

vi.mock("../src/http/fetcher.ts", async (importActual) => ({
    ...(await importActual<typeof FetcherModule>()),
    fetcher: fetcherMock,
}));

describe("boltzClient DEX quotes", () => {
    beforeEach(() => {
        fetcherMock.mockReset();
    });

    test("should sort amount-in quotes by highest output first", async () => {
        const quotes = [
            { quote: "10", data: { route: "mid" } },
            { quote: "25", data: { route: "best" } },
            { quote: "5", data: { route: "worst" } },
        ];
        fetcherMock.mockResolvedValue(quotes);

        const result = await quoteDexAmountIn("ETH", "tokenA", "tokenB", 100n);

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/quote/ETH/in?tokenIn=tokenA&tokenOut=tokenB&amountIn=100",
        );
        expect(result.map(({ quote }) => quote)).toEqual(["25", "10", "5"]);
        expect(quotes.map(({ quote }) => quote)).toEqual(["10", "25", "5"]);
    });

    test("should sort amount-out quotes by lowest input first", async () => {
        const quotes = [
            { quote: "10", data: { route: "mid" } },
            { quote: "25", data: { route: "worst" } },
            { quote: "5", data: { route: "best" } },
        ];
        fetcherMock.mockResolvedValue(quotes);

        const result = await quoteDexAmountOut("ETH", "tokenA", "tokenB", 100n);

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/quote/ETH/out?tokenIn=tokenA&tokenOut=tokenB&amountOut=100",
        );
        expect(result.map(({ quote }) => quote)).toEqual(["5", "10", "25"]);
        expect(quotes.map(({ quote }) => quote)).toEqual(["10", "25", "5"]);
    });
});

describe("getSwapStatuses", () => {
    beforeEach(() => {
        fetcherMock.mockReset();
    });

    test("returns an empty map without a request for no ids", async () => {
        const result = await getSwapStatuses([]);
        expect(result).toEqual({});
        expect(fetcherMock).not.toHaveBeenCalled();
    });

    test("builds the ids query and returns the status map", async () => {
        fetcherMock.mockResolvedValue({ a: { status: "swap.created" } });

        const result = await getSwapStatuses(["a", "b"]);

        expect(fetcherMock).toHaveBeenCalledWith("/v2/swap/status?ids=a&ids=b");
        expect(result).toEqual({ a: { status: "swap.created" } });
    });

    test("url-encodes ids", async () => {
        fetcherMock.mockResolvedValue({});
        await getSwapStatuses(["a b", "c/d"]);
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/status?ids=a%20b&ids=c%2Fd",
        );
    });

    test("chunks at 64 ids per request and merges the results", async () => {
        const ids = Array.from({ length: 65 }, (_, i) => `id${i}`);
        fetcherMock
            .mockResolvedValueOnce({ [ids[0]]: { status: "a" } })
            .mockResolvedValueOnce({ [ids[64]]: { status: "b" } });

        const result = await getSwapStatuses(ids);

        expect(fetcherMock).toHaveBeenCalledTimes(2);
        const firstUrl = fetcherMock.mock.calls[0][0] as string;
        expect(firstUrl.split("ids=").length - 1).toBe(64);
        expect(fetcherMock.mock.calls[1][0]).toBe("/v2/swap/status?ids=id64");
        expect(result).toEqual({
            id0: { status: "a" },
            id64: { status: "b" },
        });
    });

    test("sends exactly one request for the 64-id boundary", async () => {
        const ids = Array.from({ length: 64 }, (_, i) => `id${i}`);
        fetcherMock.mockResolvedValue(
            Object.fromEntries(ids.map((id) => [id, { status: "ok" }])),
        );

        const result = await getSwapStatuses(ids);

        expect(fetcherMock).toHaveBeenCalledTimes(1);
        expect(Object.keys(result)).toHaveLength(64);
    });

    test("rejects the whole call when any chunk fails (all-or-nothing)", async () => {
        const ids = Array.from({ length: 65 }, (_, i) => `id${i}`);
        fetcherMock
            .mockResolvedValueOnce({ id0: { status: "a" } })
            .mockRejectedValueOnce(new Error("could not find swap"));

        await expect(getSwapStatuses(ids)).rejects.toThrow(
            "could not find swap",
        );
        expect(fetcherMock).toHaveBeenCalledTimes(2);
    });
});

describe("boltzClient swap metadata", () => {
    beforeEach(() => {
        fetcherMock.mockReset();
        fetcherMock.mockResolvedValue({});
    });

    test("create requests store encrypted route metadata when provided", async () => {
        await createSubmarineSwap(
            "WBTC",
            "BTC",
            "lninvoice",
            "pair-hash",
            "refundpub",
            "encrypted-metadata",
        );

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/submarine",
            expect.objectContaining({ metadata: "encrypted-metadata" }),
        );

        fetcherMock.mockClear();
        await createReverseSwap(
            "BTC",
            "TBTC",
            1_000,
            "preimagehash",
            "pair-hash",
            "claimpub",
            "claimaddr",
            "encrypted-metadata",
        );
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/reverse",
            expect.objectContaining({ metadata: "encrypted-metadata" }),
        );

        fetcherMock.mockClear();
        await createChainSwap(
            "BTC",
            "TBTC",
            1_000,
            "preimagehash",
            "claimpub",
            "refundpub",
            "claimaddr",
            "pair-hash",
            "encrypted-metadata",
        );
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/chain",
            expect.objectContaining({ metadata: "encrypted-metadata" }),
        );
    });

    test("patches metadata on the metadata endpoint", async () => {
        await patchSwapMetadata("swap-id", "encrypted-metadata");

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/swap-id/metadata",
            { metadata: "encrypted-metadata" },
            { method: "PATCH" },
        );
    });
});
