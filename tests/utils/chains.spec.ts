import { expect, test } from "vitest";

import {
    decodeSolanaAddress,
    isValidSolanaAddress,
    isValidSolanaHexAddress,
} from "../../src/utils/chains/solana";
import {
    decodeTronBase58Address,
    isValidTronAddress,
} from "../../src/utils/chains/tron";

test("should validate Solana base58 and hex recipients", () => {
    const recipient = "11111111111111111111111111111111";

    expect(isValidSolanaAddress(recipient)).toBe(true);
    expect(decodeSolanaAddress(recipient)).toHaveLength(32);
    expect(
        isValidSolanaHexAddress(
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        ),
    ).toBe(true);
    expect(isValidSolanaHexAddress("0x1234")).toBe(false);
});

test("should validate Tron base58 recipients", () => {
    const recipient = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

    expect(isValidTronAddress(recipient)).toBe(true);
    expect(decodeTronBase58Address(recipient)).toHaveLength(20);
    expect(isValidTronAddress("TInvalidAddress")).toBe(false);
});
