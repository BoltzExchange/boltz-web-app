import { OutputType } from "boltz-core";
import type { RestorableSwap } from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";
import { describe, expect, test } from "vitest";

import { BTC, LBTC, LUSDT, RBTC } from "../../src/consts/Assets";
import { mapSwap } from "../../src/pages/RefundRescue";

const tree = {
    claimLeaf: { output: "claim", version: 0xc0 },
    refundLeaf: { output: "refund", version: 0xc0 },
};

const baseDetails = {
    tree,
    keyIndex: 7,
    lockupAddress: "tb1qlockup",
    serverPublicKey: "02aabbcc",
    timeoutBlockHeight: 123_456,
};

const baseSwap = {
    id: "swap-id",
    status: "pending",
    createdAt: 1700000000,
};

describe("mapSwap", () => {
    test("returns undefined for missing swap", () => {
        expect(mapSwap(undefined)).toBeUndefined();
    });

    test("returns undefined when refundDetails are missing for submarine", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Submarine,
            from: BTC,
            to: BTC,
        };
        expect(mapSwap(swap)).toBeUndefined();
    });

    test("returns undefined when claimDetails are missing for reverse", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Reverse,
            from: BTC,
            to: BTC,
        };
        expect(mapSwap(swap)).toBeUndefined();
    });

    test("submarine output preserves the legacy keys downstream relies on", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Submarine,
            from: BTC,
            to: LBTC,
            refundDetails: { ...baseDetails, blindingKey: "deadbeef" },
        };

        const mapped = mapSwap(swap);
        expect(mapped).toMatchObject({
            type: SwapType.Submarine,
            assetSend: BTC,
            assetReceive: LBTC,
            version: OutputType.Taproot,
            address: baseDetails.lockupAddress,
            blindingKey: "deadbeef",
            swapTree: tree,
            refundPrivateKeyIndex: baseDetails.keyIndex,
            claimPublicKey: baseDetails.serverPublicKey,
            timeoutBlockHeight: baseDetails.timeoutBlockHeight,
        });
    });

    test("reverse output renames address to lockupAddress and exposes claim metadata", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Reverse,
            from: BTC,
            to: BTC,
            claimDetails: { ...baseDetails, amount: 4242 },
        };

        const mapped = mapSwap(swap);
        expect(mapped).toMatchObject({
            type: SwapType.Reverse,
            assetSend: BTC,
            assetReceive: BTC,
            version: OutputType.Taproot,
            lockupAddress: baseDetails.lockupAddress,
            timeoutBlockHeight: baseDetails.timeoutBlockHeight,
            claimPrivateKeyIndex: baseDetails.keyIndex,
            sendAmount: 4242,
        });
        // The legacy "address" key is gone — reverse swaps now expose lockupAddress.
        expect(mapped).not.toHaveProperty("address");
    });

    test("reverse Liquid USDt output keeps the intermediary key index for rescue", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Reverse,
            from: BTC,
            to: LUSDT,
            claimDetails: { ...baseDetails, keyIndex: 42, amount: 123_456 },
        };

        expect(mapSwap(swap)).toMatchObject({
            type: SwapType.Reverse,
            assetSend: BTC,
            assetReceive: LUSDT,
            claimPrivateKeyIndex: 42,
            sendAmount: 123_456,
        });
    });

    test("chain output collapses refund details into lockupDetails and drops legacy duplicates", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Chain,
            from: RBTC,
            to: BTC,
            claimDetails: { ...baseDetails, keyIndex: 11 },
            refundDetails: { ...baseDetails, keyIndex: 9 },
        };

        const mapped = mapSwap(swap);
        expect(mapped).toMatchObject({
            type: SwapType.Chain,
            assetSend: RBTC,
            assetReceive: BTC,
            version: OutputType.Taproot,
            refundPrivateKeyIndex: 9,
            claimPrivateKeyIndex: 11,
            lockupDetails: {
                ...baseDetails,
                keyIndex: 9,
                swapTree: tree,
            },
        });

        // Top-level legacy duplicates must be dropped — readers go through
        // lockupDetails.* instead. If these come back, downstream logic that
        // narrows on swap shape will silently pick the wrong source of truth.
        expect(mapped).not.toHaveProperty("address");
        expect(mapped).not.toHaveProperty("claimPublicKey");
        expect(mapped).not.toHaveProperty("timeoutBlockHeight");
        expect(mapped).not.toHaveProperty("claimDetails");
        expect(mapped).not.toHaveProperty("refundDetails");
    });
});
