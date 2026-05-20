import { decodeBase64 } from "../../src/util/base64.ts";

const hexOf = (bytes: Uint8Array): string =>
    [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

describe("decodeBase64", () => {
    test.each([
        ["", ""],
        ["AA==", "00"],
        ["AAA=", "0000"],
        ["AAAA", "000000"],
        ["AAECAwQFBgcICQ==", "00010203040506070809"],
        ["SGVsbG8sIFdvcmxkIQ==", "48656c6c6f2c20576f726c6421"],
        [
            "ESIzRFVmd4iZqrvM3e7/AAECAwQFBgcICQoLDA0ODxA=",
            "112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f10",
        ],
    ])("decodeBase64(%j) → %s", (input, expectedHex) => {
        expect(hexOf(decodeBase64(input))).toBe(expectedHex);
    });

    test("returns a Uint8Array", () => {
        expect(decodeBase64("AAECAw==")).toBeInstanceOf(Uint8Array);
    });
});
