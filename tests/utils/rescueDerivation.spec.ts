import { hex } from "@scure/base";

import {
    derivePreimage,
    evmPath,
    mnemonicToHDKey,
} from "../../src/utils/rescueDerivation";

describe("rescueDerivation", () => {
    const mnemonic =
        "invite smile evidence shield frost source truly ball odor unfold example nuclear";

    describe("evmPath", () => {
        test.each`
            chainId     | expected
            ${33}       | ${"m/44/33/0/0"}
            ${42161}    | ${"m/44/42161/0/0"}
            ${11155111} | ${"m/44/11155111/0/0"}
        `(
            "returns the expected path for chain $chainId",
            ({ chainId, expected }) => {
                expect(evmPath(chainId)).toBe(expected);
            },
        );
    });

    describe("mnemonicToHDKey", () => {
        test("derives a deterministic HD key from the mnemonic", () => {
            const hdKey = mnemonicToHDKey(mnemonic);

            expect(hdKey.publicExtendedKey).toBe(
                "xpub661MyMwAqRbcG5eD5Hh9EddaCEik4rxpJA1RDEsxjujXzGsJDg4kT7EXC8GPM4ZZLVCoNA8fArGbjqKmo6M6khKTaTmYBJNTQXCFrejsgCi",
            );
            expect(hdKey.privateExtendedKey).toBe(
                "xprv9s21ZrQH143K3bZjyGA8sVgqeCtFfQExvw5pQrUMBaCZ7UY9g8kVuJv3LrBbAGFuXbN88CvtVqSyDEaCAt2N9DbYhFagEFMP12BddeXuMdf",
            );
        });

        test("returns the same key for repeated calls", () => {
            const key1 = mnemonicToHDKey(mnemonic);
            const key2 = mnemonicToHDKey(mnemonic);

            expect(key1.publicExtendedKey).toBe(key2.publicExtendedKey);
            expect(key1.privateExtendedKey).toBe(key2.privateExtendedKey);
        });
    });

    describe("derivePreimage", () => {
        test("hashes the private key with sha256", () => {
            const privateKey = hex.decode(
                "cb9774710e1d1eaa747a38fff23b20cbb5847e1586e97ebdca36489f3a0105d8",
            );

            expect(hex.encode(derivePreimage(privateKey))).toBe(
                "44789b9c9813e523f0acfa300b8aeff383d21b9aaab6847b6bd6676c6a10518d",
            );
        });

        test("throws when the private key is missing", () => {
            expect(() => derivePreimage(null as unknown as Uint8Array)).toThrow(
                "failed to derive private key",
            );
        });
    });
});
