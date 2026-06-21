import { getChainSwapClaimDetails } from "boltz-swaps/client";
import { describe, expect, test, vi } from "vitest";

import { BTC, RBTC, TBTC, USDC, USDT0, WBTC } from "../../src/consts/Assets";
import type { ChainSwap } from "../../src/utils/swapCreator";

vi.mock("boltz-swaps/client", () => ({
    getChainSwapClaimDetails: vi.fn(),
}));

const { createTheirPartialChainSwapSignature } =
    await import("../../src/utils/claim");

const deriveKey = vi.fn();

describe("createTheirPartialChainSwapSignature", () => {
    test.each([RBTC, TBTC, WBTC, USDT0, USDC])(
        "returns undefined without hitting the backend when assetSend is %s",
        async (assetSend) => {
            vi.mocked(getChainSwapClaimDetails).mockClear();

            const swap = { id: "evm-swap", assetSend } as unknown as ChainSwap;

            await expect(
                createTheirPartialChainSwapSignature(deriveKey, swap),
            ).resolves.toBeUndefined();

            expect(getChainSwapClaimDetails).not.toHaveBeenCalled();
        },
    );

    const utxoSourceSwap = {
        id: "btc-swap",
        assetSend: BTC,
        refundPrivateKey: "11".repeat(32),
        lockupDetails: { swapTree: {} },
    } as unknown as ChainSwap;

    test("returns undefined when backend rejects with the not-eligible Error", async () => {
        vi.mocked(getChainSwapClaimDetails).mockRejectedValueOnce(
            new Error("swap not eligible for a cooperative claim"),
        );

        await expect(
            createTheirPartialChainSwapSignature(deriveKey, utxoSourceSwap),
        ).resolves.toBeUndefined();
    });

    test("re-throws unrelated errors", async () => {
        const err = new Error("something else broke");
        vi.mocked(getChainSwapClaimDetails).mockRejectedValueOnce(err);

        await expect(
            createTheirPartialChainSwapSignature(deriveKey, utxoSourceSwap),
        ).rejects.toThrow("something else broke");
    });
});
