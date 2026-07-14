import { afterEach, describe, expect, it, vi } from "vitest";

import { deriveDepositAccount } from "../../src/deposit/derivation.ts";

const MNEMONIC = "test test test test test test test test test test test junk";

vi.mock("../../src/config.ts", () => ({
    requireRpcUrls: vi.fn(() => ["https://rpc.example"]),
}));

// createProviderTransport must return a real viem transport factory; a plain
// stub makes createWalletClient throw 'transport is not a function' offline.
vi.mock("../../src/evm/provider.ts", async () => {
    const { http } = await import("viem");
    return {
        createAssetProvider: vi.fn(() => ({ id: "prov" })),
        createProviderTransport: vi.fn(() => http("https://rpc.example")),
    };
});

const { requireRpcUrls } = await import("../../src/config.ts");
const { createProviderTransport } = await import("../../src/evm/provider.ts");
const { buildDepositSigner } = await import("../../src/deposit/signer.ts");

afterEach(() => vi.clearAllMocks());

describe("buildDepositSigner", () => {
    it("wraps the account into a Signer for the asset's chain", () => {
        const account = deriveDepositAccount(MNEMONIC, 0);
        const s = buildDepositSigner(account, "USDC-POL");

        expect(s.address).toBe(account.address);
        expect(s.rdns).toBe("boltz-deposit");
        expect(s.provider).toEqual({ id: "prov" });
        expect(requireRpcUrls).toHaveBeenCalledWith("USDC-POL");
        expect(createProviderTransport).toHaveBeenCalledWith([
            "https://rpc.example",
        ]);
    });
});
