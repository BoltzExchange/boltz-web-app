import { LBTC, LN, RBTC, USDT0 } from "../../src/consts/Assets";
import { SwapPosition, SwapType } from "../../src/consts/Enums";
import {
    migrateSwapBridgeShape,
    migrateSwapDexPositionShape,
    migrateSwapGasAbstraction,
    migrateSwapGasAbstractionShape,
    migrateSwapToChainSwapFormat,
} from "../../src/utils/migration";
import {
    GasAbstractionType,
    type SomeSwap,
    createUniformGasAbstraction,
} from "../../src/utils/swapCreator";

describe("migration", () => {
    test("should migrate legacy format to chain swap format", () => {
        const swaps = [
            {
                id: "submarine",
                reverse: false,
                asset: LBTC,
                privateKey: "123",
                other: "data",
            },
            {
                id: "reverse",
                reverse: true,
                asset: RBTC,
                privateKey: "321",
                other: "info",
            },
        ];

        const migrated = swaps
            .map(migrateSwapToChainSwapFormat)
            .map((swap) => migrateSwapGasAbstraction(swap as never));

        expect(migrated).toEqual([
            {
                ...swaps[0],
                assetSend: LBTC,
                assetReceive: LN,
                gasAbstraction: createUniformGasAbstraction(
                    GasAbstractionType.None,
                ),
                type: SwapType.Submarine,
                refundPrivateKey: swaps[0].privateKey,
            },
            {
                ...swaps[1],
                assetSend: LN,
                assetReceive: RBTC,
                gasAbstraction: createUniformGasAbstraction(
                    GasAbstractionType.None,
                ),
                type: SwapType.Reverse,
                claimPrivateKey: swaps[1].privateKey,
            },
        ]);
    });

    test("should migrate legacy gas abstraction booleans", () => {
        const swaps = [
            {
                id: "reverse-rbtc",
                assetSend: LN,
                assetReceive: RBTC,
                useGasAbstraction: true,
            },
            {
                id: "reverse-usdt0",
                assetSend: LN,
                assetReceive: USDT0,
                useGasAbstraction: true,
            },
            {
                id: "submarine",
                assetSend: LBTC,
                assetReceive: LN,
                useGasAbstraction: false,
            },
        ];

        const migrated = swaps
            .map(migrateSwapGasAbstraction)
            .map((swap) => migrateSwapGasAbstractionShape(swap as never));

        expect(migrated).toEqual([
            {
                id: "reverse-rbtc",
                assetSend: LN,
                assetReceive: RBTC,
                gasAbstraction: {
                    claim: GasAbstractionType.RifRelay,
                    lockup: GasAbstractionType.None,
                },
            },
            {
                id: "reverse-usdt0",
                assetSend: LN,
                assetReceive: USDT0,
                gasAbstraction: {
                    claim: GasAbstractionType.Signer,
                    lockup: GasAbstractionType.None,
                },
            },
            {
                id: "submarine",
                assetSend: LBTC,
                assetReceive: LN,
                gasAbstraction: createUniformGasAbstraction(
                    GasAbstractionType.None,
                ),
            },
        ]);
    });

    test("should migrate legacy flat OFT detail to enum-based post bridge", () => {
        const swaps = [
            {
                id: "post-oft",
                oft: {
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                },
            },
        ];

        expect(swaps.map(migrateSwapBridgeShape)).toEqual([
            {
                id: "post-oft",
                bridge: {
                    kind: "oft",
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    position: SwapPosition.Post,
                },
            },
        ]);
    });

    test("should migrate pre/post OFT shape to enum-based bridge", () => {
        const swaps = [
            {
                id: "pre-oft",
                oft: {
                    pre: {
                        sourceAsset: "USDT0-POL",
                        destinationAsset: USDT0,
                    },
                },
            },
            {
                id: "post-oft",
                oft: {
                    post: {
                        sourceAsset: USDT0,
                        destinationAsset: "USDT0-ETH",
                    },
                },
            },
        ];

        expect(swaps.map(migrateSwapBridgeShape)).toEqual([
            {
                id: "pre-oft",
                bridge: {
                    kind: "oft",
                    sourceAsset: "USDT0-POL",
                    destinationAsset: USDT0,
                    position: SwapPosition.Pre,
                },
            },
            {
                id: "post-oft",
                bridge: {
                    kind: "oft",
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    position: SwapPosition.Post,
                },
            },
        ]);
    });

    test("should preserve an existing bridge.kind on re-migration", () => {
        const swaps = [
            {
                id: "already-bridge",
                bridge: {
                    kind: "future-bridge",
                    sourceAsset: "FOO",
                    destinationAsset: "FOO-BAR",
                    position: SwapPosition.Post,
                },
            },
        ];

        expect(swaps.map(migrateSwapBridgeShape)).toEqual([
            {
                id: "already-bridge",
                bridge: {
                    kind: "future-bridge",
                    sourceAsset: "FOO",
                    destinationAsset: "FOO-BAR",
                    position: SwapPosition.Post,
                },
            },
        ]);
    });

    test("should migrate legacy dex hop position wording", () => {
        const swaps = [
            {
                id: "dex-pre",
                dex: {
                    position: "before",
                    hops: [],
                    quoteAmount: "123",
                },
            },
            {
                id: "dex-post",
                dex: {
                    position: "after",
                    hops: [],
                    quoteAmount: "456",
                },
            },
        ];

        expect(
            (swaps as unknown as SomeSwap[]).map(migrateSwapDexPositionShape),
        ).toEqual([
            {
                id: "dex-pre",
                dex: {
                    position: "pre",
                    hops: [],
                    quoteAmount: "123",
                },
            },
            {
                id: "dex-post",
                dex: {
                    position: "post",
                    hops: [],
                    quoteAmount: "456",
                },
            },
        ]);
    });
});
