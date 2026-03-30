import { expect, test } from "vitest";

import {
    decodeTronBase58Address,
    isValidTronAddress,
} from "../../../src/utils/chains/tron";

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
