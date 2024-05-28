import { LBTC, LN, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import {
    latestStorageVersion,
    migrateBackupFile,
} from "../../src/utils/migration";

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
                type: SwapType.Submarine,
                refundPrivateKey: swaps[0].privateKey,
            },
            {
                ...swaps[1],
                assetSend: LN,
                assetReceive: RBTC,
                type: SwapType.Reverse,
                claimPrivateKey: swaps[1].privateKey,
            },
        ]);
    });

    test("should detect already up to date backup files", () => {
        const swaps = [{ id: "someSwap" }];
        expect(migrateBackupFile(latestStorageVersion, swaps)).toEqual(swaps);
    });
});
