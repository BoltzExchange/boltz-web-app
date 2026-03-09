import {
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "../../src/utils/boltzClient";

const { fetcherMock } = vi.hoisted(() => ({
    fetcherMock: vi.fn(),
}));

vi.mock("../../src/utils/helper", () => ({
    fetcher: fetcherMock,
    getReferral: vi.fn(() => "test-referral"),
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
