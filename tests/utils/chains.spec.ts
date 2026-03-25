import { expect, test } from "vitest";

import {
    decodeSolanaAddress,
    isValidSolanaAddress,
} from "../../src/utils/chains/solana";
import {
    decodeTronBase58Address,
    isValidTronAddress,
} from "../../src/utils/chains/tron";

test("should validate Solana base58 recipients", () => {
    const recipient = "11111111111111111111111111111111";
    const invalidRecipients = [
        "",
        "1111111111111111111111111111111",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "O0Il1111111111111111111111111111",
    ];

    expect(isValidSolanaAddress(recipient)).toBe(true);
    expect(decodeSolanaAddress(recipient)).toHaveLength(32);

    invalidRecipients.forEach((invalidRecipient) => {
        expect(isValidSolanaAddress(invalidRecipient)).toBe(false);
        expect(() => decodeSolanaAddress(invalidRecipient)).toThrow();
    });
});

test("should validate Tron base58 recipients", () => {
    const recipient = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    const invalidRecipients = [
        "TInvalidAddress",
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u",
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6",
    ];

    expect(isValidTronAddress(recipient)).toBe(true);
    expect(decodeTronBase58Address(recipient)).toHaveLength(20);

    invalidRecipients.forEach((invalidRecipient) => {
        expect(isValidTronAddress(invalidRecipient)).toBe(false);
        expect(() => decodeTronBase58Address(invalidRecipient)).toThrow();
    });
});
