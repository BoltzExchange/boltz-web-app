import { LBTC, LN, RBTC, USDT0 } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import {
    latestStorageVersion,
    migrateBackupFile,
} from "../../src/utils/migration";
import { GasAbstractionType, OftPosition } from "../../src/utils/swapCreator";

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
                gasAbstraction: GasAbstractionType.None,
                type: SwapType.Submarine,
                refundPrivateKey: swaps[0].privateKey,
            },
            {
                ...swaps[1],
                assetSend: LN,
                assetReceive: RBTC,
                gasAbstraction: GasAbstractionType.None,
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
                assetReceive: RBTC,
                useGasAbstraction: true,
            },
            {
                id: "reverse-usdt0",
                assetReceive: USDT0,
                useGasAbstraction: true,
            },
            {
                id: "submarine",
                assetReceive: LN,
                useGasAbstraction: false,
            },
        ];

        expect(migrateBackupFile(2, swaps)).toEqual([
            {
                id: "reverse-rbtc",
                assetReceive: RBTC,
                gasAbstraction: GasAbstractionType.RifRelay,
            },
            {
                id: "reverse-usdt0",
                assetReceive: USDT0,
                gasAbstraction: GasAbstractionType.Signer,
            },
            {
                id: "submarine",
                assetReceive: LN,
                gasAbstraction: GasAbstractionType.None,
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
                    destinationChainId: 1,
                },
            },
        ];

        expect(migrateBackupFile(3, swaps)).toEqual([
            {
                id: "post-oft",
                oft: {
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    destinationChainId: 1,
                    position: OftPosition.Post,
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
                        destinationChainId: 42161,
                    },
                },
            },
            {
                id: "post-oft",
                oft: {
                    post: {
                        sourceAsset: USDT0,
                        destinationAsset: "USDT0-ETH",
                        destinationChainId: 1,
                    },
                },
            },
        ];

        expect(migrateBackupFile(3, swaps)).toEqual([
            {
                id: "pre-oft",
                oft: {
                    sourceAsset: "USDT0-POL",
                    destinationAsset: USDT0,
                    destinationChainId: 42161,
                    position: OftPosition.Pre,
                },
            },
            {
                id: "post-oft",
                oft: {
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    destinationChainId: 1,
                    position: OftPosition.Post,
                },
            },
        ]);
    });
});
