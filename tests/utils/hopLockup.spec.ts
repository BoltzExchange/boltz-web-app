import { SwapType } from "boltz-swaps/types";
import { describe, expect, test, vi } from "vitest";

import { hopShortfallIsRenegotiable } from "../../src/utils/hopLockup";
import type { SomeSwap } from "../../src/utils/swapCreator";

// 1:1 sats conversion so the tests can use raw numbers.
vi.mock("boltz-swaps/evm", () => ({
    assetAmountToSats: (amount: bigint) => amount,
}));

describe("hopShortfallIsRenegotiable", () => {
    const slippage = 0.01;
    const quoteAmountOut = 1_000n;
    // calculateAmountOutMin(1000, 0.01) === 990
    const lockupAmount = 990n;

    const chainSwap = {
        type: SwapType.Chain,
        assetSend: "RBTC",
        assetReceive: "BTC",
    } as unknown as SomeSwap;

    const pairsWith = (minimal?: number) => () =>
        ({
            [SwapType.Chain]: {
                RBTC: {
                    BTC: {
                        limits: minimal === undefined ? {} : { minimal },
                    },
                },
            },
        }) as never;

    test.each([SwapType.Submarine, SwapType.Reverse, SwapType.Commitment])(
        "blocks a %s swap shortfall (never renegotiable) without fetching pairs",
        async (type) => {
            const fetchPairs = vi.fn().mockResolvedValue(undefined);
            const result = await hopShortfallIsRenegotiable(
                { type } as unknown as SomeSwap,
                quoteAmountOut,
                slippage,
                pairsWith(100),
                fetchPairs,
            );

            expect(result).toBe(false);
            expect(fetchPairs).not.toHaveBeenCalled();
        },
    );

    test("locks a chain swap shortfall when the pair has no minimum", async () => {
        const fetchPairs = vi.fn().mockResolvedValue(undefined);
        const result = await hopShortfallIsRenegotiable(
            chainSwap,
            quoteAmountOut,
            slippage,
            pairsWith(undefined),
            fetchPairs,
        );

        expect(result).toBe(true);
        expect(fetchPairs).toHaveBeenCalledOnce();
    });

    test("locks a chain swap shortfall that still clears the pair minimum", async () => {
        const result = await hopShortfallIsRenegotiable(
            chainSwap,
            quoteAmountOut,
            slippage,
            pairsWith(Number(lockupAmount)),
            vi.fn().mockResolvedValue(undefined),
        );

        expect(result).toBe(true);
    });

    test("blocks a chain swap shortfall that falls below the pair minimum", async () => {
        const result = await hopShortfallIsRenegotiable(
            chainSwap,
            quoteAmountOut,
            slippage,
            pairsWith(Number(lockupAmount) + 1),
            vi.fn().mockResolvedValue(undefined),
        );

        expect(result).toBe(false);
    });
});
