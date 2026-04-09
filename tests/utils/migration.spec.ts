import { LBTC, LN, RBTC, USDT0 } from "../../src/consts/Assets";
import { SwapPosition, SwapType } from "../../src/consts/Enums";
import {
    latestStorageVersion,
    migrateBackupFile,
} from "../../src/utils/migration";
import {
    GasAbstractionType,
    createUniformGasAbstraction,
} from "../../src/utils/swapCreator";

describe("migration", () => {
    test("should migrate backup files", () => {
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

        expect(migrateBackupFile(0, swaps)).toEqual([
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

    test("should detect already up to date backup files", () => {
        const swaps = [{ id: "someSwap" }];
        expect(migrateBackupFile(latestStorageVersion, swaps)).toEqual(swaps);
    });

    test("should migrate legacy gas abstraction booleans in backup files", () => {
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

        expect(migrateBackupFile(2, swaps)).toEqual([
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

    test("should migrate legacy flat OFT detail to enum-based post OFT", () => {
        const swaps = [
            {
                id: "post-oft",
                oft: {
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                },
            },
        ];

        expect(migrateBackupFile(3, swaps)).toEqual([
            {
                id: "post-oft",
                gasAbstraction: createUniformGasAbstraction(
                    GasAbstractionType.None,
                ),
                oft: {
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    position: SwapPosition.Post,
                },
            },
        ]);
    });

    test("should migrate pre/post OFT shape to enum-based OFT", () => {
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

        expect(migrateBackupFile(3, swaps)).toEqual([
            {
                id: "pre-oft",
                gasAbstraction: createUniformGasAbstraction(
                    GasAbstractionType.None,
                ),
                oft: {
                    sourceAsset: "USDT0-POL",
                    destinationAsset: USDT0,
                    position: SwapPosition.Pre,
                },
            },
            {
                id: "post-oft",
                gasAbstraction: createUniformGasAbstraction(
                    GasAbstractionType.None,
                ),
                oft: {
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
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

        expect(migrateBackupFile(5, swaps)).toEqual([
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
