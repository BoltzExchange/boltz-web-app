import { LBTC, LN, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import { migrateSwapToChainSwapFormat } from "../../src/utils/migration";

describe("migration", () => {
    test("should migrate legacy submarine swaps to chain swap format", () => {
        const swap = {
            id: "submarine",
            reverse: false,
            asset: LBTC,
            privateKey: "123",
            other: "data",
        };

        expect(migrateSwapToChainSwapFormat(swap)).toEqual({
            ...swap,
            assetSend: LBTC,
            assetReceive: LN,
            type: SwapType.Submarine,
            refundPrivateKey: swap.privateKey,
        });
    });

    test("should migrate legacy reverse swaps to chain swap format", () => {
        const swap = {
            id: "reverse",
            reverse: true,
            asset: RBTC,
            privateKey: "321",
            other: "info",
        };

        expect(migrateSwapToChainSwapFormat(swap)).toEqual({
            ...swap,
            assetSend: LN,
            assetReceive: RBTC,
            type: SwapType.Reverse,
            claimPrivateKey: swap.privateKey,
        });
    });
});
