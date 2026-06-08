import {
    createChainSwap,
    createReverseSwap,
    createSubmarineSwap,
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

describe("boltzClient swap metadata", () => {
    beforeEach(() => {
        fetcherMock.mockReset();
        fetcherMock.mockResolvedValue({});
    });

    test("submarine swap forwards metadata in the request body", async () => {
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
    });

    test("reverse swap forwards metadata in the request body", async () => {
        await createReverseSwap(
            "BTC",
            "TBTC",
            1000,
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
    });

    test("chain swap forwards metadata in the request body", async () => {
        await createChainSwap(
            "BTC",
            "TBTC",
            1000,
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

    test("omits metadata when none is provided", async () => {
        await createSubmarineSwap("BTC", "BTC", "lninvoice", "pair-hash");

        const body = fetcherMock.mock.calls[0][1];
        expect(body.metadata).toBeUndefined();
    });
});
