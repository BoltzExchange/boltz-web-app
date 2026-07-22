import type { RestorableSwap } from "boltz-swaps/client";
import { SwapPosition, SwapType } from "boltz-swaps/types";
import { describe, expect, test } from "vitest";

import { getRestoredSwapIconAssets } from "../../src/components/SwapIcons";
import { LN, TBTC, USDT0 } from "../../src/consts/Assets";
import type { DexDetail } from "../../src/utils/swapCreator";

const baseSwap = {
    id: "restored-swap",
    status: "transaction.confirmed",
    createdAt: 1,
    from: TBTC,
    to: "L-BTC",
} satisfies Omit<RestorableSwap, "type">;

describe("getRestoredSwapIconAssets", () => {
    test("shows both assets for a restored swap", () => {
        expect(
            getRestoredSwapIconAssets({
                ...baseSwap,
                type: SwapType.Reverse,
            }),
        ).toEqual({ send: LN, receive: "L-BTC" });
    });

    test("uses hydrated route metadata for the displayed asset pair", () => {
        const dex: DexDetail = {
            position: SwapPosition.Pre,
            quoteAmount: "1000",
            hops: [
                {
                    type: SwapType.Dex,
                    from: USDT0,
                    to: TBTC,
                    dexDetails: undefined,
                },
            ],
        };

        expect(
            getRestoredSwapIconAssets({
                ...baseSwap,
                type: SwapType.Chain,
                dex,
            } as RestorableSwap & { dex: DexDetail }),
        ).toEqual({ send: USDT0, receive: "L-BTC" });
    });
});
