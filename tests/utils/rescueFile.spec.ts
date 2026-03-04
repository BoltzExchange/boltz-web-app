import { BTC, RBTC, TBTC } from "../../src/consts/Assets";
import {
    Errors,
    derivationPath,
    deriveKey,
    deriveKeyGasAbstraction,
    derivePreimageFromRescueKey,
    generateRescueFile,
    getXpub,
    mnemonicToHDKey,
    validateRescueFile,
} from "../../src/utils/rescueFile";
import type { RescueFile } from "../../src/utils/rescueFile";

describe("rescueFile", () => {
    const rescueFile: RescueFile = {
        mnemonic:
            "invite smile evidence shield frost source truly ball odor unfold example nuclear",
    } as const;

    describe("getXpub", () => {
        test("should derive xpub from mnemonic", () => {
            const xpub = getXpub(rescueFile);
            expect(xpub).toEqual(
                "xpub661MyMwAqRbcG5eD5Hh9EddaCEik4rxpJA1RDEsxjujXzGsJDg4kT7EXC8GPM4ZZLVCoNA8fArGbjqKmo6M6khKTaTmYBJNTQXCFrejsgCi",
            );
        });

        test("should throw error if mnemonic is invalid", () => {
            expect(() =>
                getXpub({
                    mnemonic: "invalid",
                }),
            ).toThrow();
        });
    });

    describe("derivationPath", () => {
        test("should be the expected BIP44 path", () => {
            expect(derivationPath).toBe("m/44/0/0/0");
        });
    });

    describe("mnemonicToHDKey", () => {
        test("should derive an HDKey from a mnemonic", () => {
            const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
            expect(hdKey).toBeDefined();
            expect(hdKey.publicExtendedKey).toBeDefined();
            expect(hdKey.privateExtendedKey).toBeDefined();
        });

        test("should produce the same key for the same mnemonic", () => {
            const key1 = mnemonicToHDKey(rescueFile.mnemonic);
            const key2 = mnemonicToHDKey(rescueFile.mnemonic);
            expect(key1.publicExtendedKey).toEqual(key2.publicExtendedKey);
        });

        test("should produce different keys for different mnemonics", () => {
            const other = generateRescueFile();
            const key1 = mnemonicToHDKey(rescueFile.mnemonic);
            const key2 = mnemonicToHDKey(other.mnemonic);
            expect(key1.publicExtendedKey).not.toEqual(key2.publicExtendedKey);
        });
    });

    describe("generateRescueFile", () => {
        test("should generate a valid rescue file", () => {
            const rescueFile = generateRescueFile();

            expect(rescueFile).toHaveProperty("mnemonic");
            expect(typeof rescueFile.mnemonic).toBe("string");

            // Verify the mnemonic is valid by deriving an xpub from it
            expect(() => getXpub(rescueFile)).not.toThrow();
        });
    });

    describe("deriveKey", () => {
        test.each`
            index | expected
            ${0}  | ${"cb9774710e1d1eaa747a38fff23b20cbb5847e1586e97ebdca36489f3a0105d8"}
            ${1}  | ${"72a43f69c3a4cc4a2ebae6c8b12e7b56ebec3423c0acb40eba422792c8d27d6a"}
            ${2}  | ${"217c41a6670f1a104b5f0b17b0e1b60da97339c259a215825b85aed654537efc"}
        `(
            "should derive a BTC key at specified index",
            ({ index, expected }) => {
                const derivedKey = deriveKey(rescueFile, index, BTC);

                expect(derivedKey).toBeDefined();
                expect(derivedKey.privateKey).toBeDefined();
                expect(
                    Buffer.from(derivedKey.privateKey).toString("hex"),
                ).toEqual(expected);
            },
        );

        test.each([0, 1, 2])(
            "should derive different keys for RBTC vs BTC at index %i",
            (index) => {
                const btcKey = deriveKey(rescueFile, index, BTC);
                const rbtcKey = deriveKey(rescueFile, index, RBTC);

                expect(btcKey.privateKey).toBeDefined();
                expect(rbtcKey.privateKey).toBeDefined();
                expect(
                    Buffer.from(btcKey.privateKey).toString("hex"),
                ).not.toEqual(Buffer.from(rbtcKey.privateKey).toString("hex"));
            },
        );

        test("should use EVM derivation path for RBTC", () => {
            const key1 = deriveKey(rescueFile, 0, RBTC);
            const key2 = deriveKey(rescueFile, 1, RBTC);
            expect(key1.privateKey).toBeDefined();
            expect(key2.privateKey).toBeDefined();
            expect(Buffer.from(key1.privateKey).toString("hex")).not.toEqual(
                Buffer.from(key2.privateKey).toString("hex"),
            );
        });

        test("should use EVM derivation path for ERC20 assets", () => {
            const key = deriveKey(rescueFile, 0, TBTC);
            expect(key.privateKey).toBeDefined();

            const btcKey = deriveKey(rescueFile, 0, BTC);
            expect(Buffer.from(key.privateKey).toString("hex")).not.toEqual(
                Buffer.from(btcKey.privateKey).toString("hex"),
            );
        });

        test("should derive the same key when hdKey is provided", () => {
            const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
            const withoutHdKey = deriveKey(rescueFile, 0, BTC);
            const withHdKey = deriveKey(rescueFile, 0, BTC, hdKey);

            expect(
                Buffer.from(withoutHdKey.privateKey).toString("hex"),
            ).toEqual(Buffer.from(withHdKey.privateKey).toString("hex"));
        });

        test("should use provided hdKey for EVM asset", () => {
            const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
            const withoutHdKey = deriveKey(rescueFile, 0, RBTC);
            const withHdKey = deriveKey(rescueFile, 0, RBTC, hdKey);

            expect(
                Buffer.from(withoutHdKey.privateKey).toString("hex"),
            ).toEqual(Buffer.from(withHdKey.privateKey).toString("hex"));
        });
    });

    describe("deriveKeyGasAbstraction", () => {
        test("should derive a key for gas abstraction", () => {
            const key = deriveKeyGasAbstraction(rescueFile, 33);
            expect(key).toBeDefined();
            expect(key.privateKey).toBeDefined();
        });

        test("should derive different keys for different chain IDs", () => {
            const key1 = deriveKeyGasAbstraction(rescueFile, 33);
            const key2 = deriveKeyGasAbstraction(rescueFile, 42161);

            expect(Buffer.from(key1.privateKey).toString("hex")).not.toEqual(
                Buffer.from(key2.privateKey).toString("hex"),
            );
        });

        test("should be deterministic for the same inputs", () => {
            const key1 = deriveKeyGasAbstraction(rescueFile, 33);
            const key2 = deriveKeyGasAbstraction(rescueFile, 33);

            expect(Buffer.from(key1.privateKey).toString("hex")).toEqual(
                Buffer.from(key2.privateKey).toString("hex"),
            );
        });

        test("should derive a different key than deriveKey for RBTC", () => {
            const gasKey = deriveKeyGasAbstraction(rescueFile, 33);
            const regularKey = deriveKey(rescueFile, 0, RBTC);

            expect(Buffer.from(gasKey.privateKey).toString("hex")).not.toEqual(
                Buffer.from(regularKey.privateKey).toString("hex"),
            );
        });
    });

    describe("derivePreimageFromRescueKey", () => {
        test.each([0, 1, 2])(
            "should derive different preimages for RBTC vs BTC at index %i",
            (index) => {
                const btcPreimage = derivePreimageFromRescueKey(
                    rescueFile,
                    index,
                    BTC,
                );
                const rbtcPreimage = derivePreimageFromRescueKey(
                    rescueFile,
                    index,
                    RBTC,
                );

                expect(btcPreimage).toBeInstanceOf(Buffer);
                expect(rbtcPreimage).toBeInstanceOf(Buffer);
                expect(btcPreimage.toString("hex")).not.toEqual(
                    rbtcPreimage.toString("hex"),
                );
            },
        );

        test("should return a 32-byte sha256 hash", () => {
            const preimage = derivePreimageFromRescueKey(rescueFile, 0, BTC);
            expect(preimage).toBeInstanceOf(Buffer);
            expect(preimage.length).toBe(32);
        });

        test("should be deterministic", () => {
            const p1 = derivePreimageFromRescueKey(rescueFile, 0, BTC);
            const p2 = derivePreimageFromRescueKey(rescueFile, 0, BTC);
            expect(p1.toString("hex")).toEqual(p2.toString("hex"));
        });

        test("should derive different preimages for different indices", () => {
            const p0 = derivePreimageFromRescueKey(rescueFile, 0, BTC);
            const p1 = derivePreimageFromRescueKey(rescueFile, 1, BTC);
            expect(p0.toString("hex")).not.toEqual(p1.toString("hex"));
        });

        test("should produce same result with and without hdKey", () => {
            const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
            const without = derivePreimageFromRescueKey(rescueFile, 0, BTC);
            const with_ = derivePreimageFromRescueKey(
                rescueFile,
                0,
                BTC,
                hdKey,
            );
            expect(without.toString("hex")).toEqual(with_.toString("hex"));
        });
    });

    describe("validateRescueFile", () => {
        test("should accept valid rescue file", () => {
            expect(validateRescueFile(rescueFile)).toEqual(rescueFile);
        });

        test("should throw error for invalid rescue file", () => {
            const data = {
                id: "uYZcNe",
                asset: "BTC",
                privateKey:
                    "def0a13214538650fb84a7545c9b81128a639f55147cdd61c46d5ea0f70045a3",
            };

            expect(() => validateRescueFile(data)).toThrow(Errors.InvalidFile);
        });

        test("should throw error if mnemonic is invalid", () => {
            const data = {
                mnemonic: "invalid",
            };

            expect(() => validateRescueFile(data)).toThrow(
                Errors.InvalidMnemonic,
            );
        });
    });
});
