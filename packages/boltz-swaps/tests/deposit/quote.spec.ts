import { afterEach, describe, expect, it, vi } from "vitest";

import { bridgeRegistry } from "../../src/bridge/index.ts";
import { assetAmountToSats } from "../../src/evm/rootstock.ts";

vi.mock("../../src/bridge/index.ts", () => ({
    bridgeRegistry: { requireDriverForAsset: vi.fn() },
}));

vi.mock("../../src/evm/rootstock.ts", () => ({
    assetAmountToSats: vi.fn(() => 0n),
}));

const {
    chainReceiveSats,
    buildChainQuote,
    buildSubmarineQuote,
    previewDepositQuote,
    estimateBridgeNet,
} = await import("../../src/deposit/quote.ts");

const requireDriverForAsset = vi.mocked(bridgeRegistry.requireDriverForAsset);
const assetAmountToSatsMock = vi.mocked(assetAmountToSats);

const pair = { fees: { minerFees: { user: { claim: 30 } } } } as never;

describe("chainReceiveSats", () => {
    afterEach(() => vi.clearAllMocks());

    it("subtracts the user claim miner fee from the gross claim amount", () => {
        expect(
            chainReceiveSats({ claimDetails: { amount: 900 } } as never, pair),
        ).toBe(870);
    });

    it("floors at 0 when the fee exceeds the claim amount", () => {
        expect(
            chainReceiveSats({ claimDetails: { amount: 10 } } as never, pair),
        ).toBe(0);
    });
});

describe("buildChainQuote", () => {
    afterEach(() => vi.clearAllMocks());

    it("locks the lockup amount (not the claim amount) and stringifies the bridge fee", () => {
        expect(
            buildChainQuote({
                depositId: "d1",
                swapId: "s1",
                created: {
                    claimDetails: { amount: 900 },
                    lockupDetails: { amount: 990 },
                } as never,
                to: "L-BTC",
                pair,
                bridgeFee: 10000n,
            }),
        ).toEqual({
            depositId: "d1",
            swapId: "s1",
            target: "chain",
            lockAmountSats: 990,
            receiveAsset: "L-BTC",
            receiveAmountSats: 870,
            bridgeFee: "10000",
        });
    });
});

describe("buildSubmarineQuote", () => {
    afterEach(() => vi.clearAllMocks());

    it("reports the locked amount and receives BTC at invoiceSats", () => {
        expect(
            buildSubmarineQuote({
                depositId: "d1",
                swapId: "s1",
                lockAmountSats: 600000,
                invoiceSats: 495000,
                bridgeFee: 0n,
            }),
        ).toEqual({
            depositId: "d1",
            swapId: "s1",
            target: "lightning",
            lockAmountSats: 600000,
            receiveAsset: "BTC",
            receiveAmountSats: 495000,
            bridgeFee: "0",
        });
    });
});

describe("previewDepositQuote", () => {
    afterEach(() => vi.clearAllMocks());

    it("lightning target -> BTC, receiveAmount equals the gross lock amount", async () => {
        requireDriverForAsset.mockReturnValue({
            getPreRoute: () => ({}),
            quoteReceiveAmount: async () => ({ amountOut: 990000n }),
        } as never);
        assetAmountToSatsMock.mockReturnValue(990n);

        const quote = await previewDepositQuote({
            sourceAsset: "USDC-POL",
            amount: 1_000_000n,
            target: { type: "lightning", destination: "x" } as never,
        });

        expect(quote.target).toBe("lightning");
        expect(quote.receiveAsset).toBe("BTC");
        expect(quote.lockAmountSats).toBe(990);
        expect(quote.receiveAmountSats).toBe(990);
        expect(quote.bridgeFee).toBe("10000");
    });

    it("chain target -> receiveAsset from `to`, gross-ceiling receiveAmount===lockAmount", async () => {
        requireDriverForAsset.mockReturnValue({
            getPreRoute: () => ({}),
            quoteReceiveAmount: async () => ({ amountOut: 990000n }),
        } as never);
        assetAmountToSatsMock.mockReturnValue(990n);

        const quote = await previewDepositQuote({
            sourceAsset: "USDC-POL",
            amount: 1_000_000n,
            target: { type: "chain", to: "L-BTC", address: "a" } as never,
        });

        expect(quote.target).toBe("chain");
        expect(quote.receiveAsset).toBe("L-BTC");
        expect(quote.receiveAmountSats).toBe(quote.lockAmountSats);
    });
});

describe("estimateBridgeNet", () => {
    afterEach(() => vi.clearAllMocks());

    it("rejects when there is no CCTP pre-route", async () => {
        requireDriverForAsset.mockReturnValue({
            getPreRoute: () => undefined,
        } as never);

        await expect(estimateBridgeNet("USDC-POL", 1_000_000n)).rejects.toThrow(
            /no CCTP pre-route for USDC-POL/,
        );
    });

    it("floors bridgeFee at 0 when amountOut >= amount", async () => {
        requireDriverForAsset.mockReturnValue({
            getPreRoute: () => ({}),
            quoteReceiveAmount: async () => ({ amountOut: 1_000_000n }),
        } as never);

        const result = await estimateBridgeNet("USDC-POL", 1_000_000n);
        expect(result.amountOut).toBe(1_000_000n);
        expect(result.bridgeFee).toBe(0n);
    });

    it("charges the positive diff as bridgeFee", async () => {
        requireDriverForAsset.mockReturnValue({
            getPreRoute: () => ({}),
            quoteReceiveAmount: async () => ({ amountOut: 990000n }),
        } as never);

        const result = await estimateBridgeNet("USDC-POL", 1_000_000n);
        expect(result.amountOut).toBe(990000n);
        expect(result.bridgeFee).toBe(10000n);
    });
});
