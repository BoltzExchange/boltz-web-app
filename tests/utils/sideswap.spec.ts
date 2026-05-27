import { describe, expect, test } from "vitest";

import {
    getSideSwapBuyQuoteDeliverAmount,
    getSideSwapSellBaseReceiveAmount,
    isSideSwapWalletSyncError,
} from "../../src/utils/sideswap";

describe("SideSwap utilities", () => {
    test("detects transient wallet sync errors", () => {
        expect(
            isSideSwapWalletSyncError(
                new Error("invalid UTXO: unknown UTXO, wait for wallet sync"),
            ),
        ).toBe(true);
        expect(isSideSwapWalletSyncError("unknown UTXO")).toBe(true);
        expect(isSideSwapWalletSyncError("wait for wallet sync")).toBe(true);
    });

    test("does not treat quote errors as wallet sync errors", () => {
        expect(isSideSwapWalletSyncError("no matching orders")).toBe(false);
        expect(isSideSwapWalletSyncError(new Error("low balance"))).toBe(false);
    });

    test("accounts for base-asset SideSwap fees in receive and send estimates", () => {
        const quote = {
            quote_id: 1,
            base_amount: 1_318,
            quote_amount: 100_000_000,
            server_fee: 3,
            fixed_fee: 80,
            ttl: 30_000,
        };

        expect(getSideSwapSellBaseReceiveAmount(quote, "Base")).toBe(
            100_000_000,
        );
        expect(getSideSwapBuyQuoteDeliverAmount(quote, "Base")).toBe(1_401);
    });

    test("accounts for quote-asset SideSwap fees in receive estimates", () => {
        const quote = {
            quote_id: 1,
            base_amount: 1_000,
            quote_amount: 100_000_000,
            server_fee: 100_000,
            fixed_fee: 4_000_000,
            ttl: 30_000,
        };

        expect(getSideSwapSellBaseReceiveAmount(quote, "Quote")).toBe(
            95_900_000,
        );
        expect(getSideSwapBuyQuoteDeliverAmount(quote, "Quote")).toBe(1_000);
    });
});
