import { describe, expect, it } from "vitest";

import {
    deriveDepositAccount,
    deriveDepositAddress,
} from "../../src/deposit/derivation.ts";

// Well-known test mnemonic (Hardhat/anvil default) with published addresses.
const MNEMONIC = "test test test test test test test test test test test junk";

describe("deposit derivation", () => {
    it("derives the standard HD addresses at m/44'/60'/0'/0/{index}", () => {
        expect(deriveDepositAddress(MNEMONIC, 0)).toBe(
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        );
        expect(deriveDepositAddress(MNEMONIC, 1)).toBe(
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        );
    });

    it("defaults to index 0", () => {
        expect(deriveDepositAddress(MNEMONIC)).toBe(
            deriveDepositAddress(MNEMONIC, 0),
        );
    });

    it("returns a local account with a sign method (required for 7702)", () => {
        const account = deriveDepositAccount(MNEMONIC, 0);
        expect(account.type).toBe("local");
        expect(typeof account.sign).toBe("function");
    });
});
