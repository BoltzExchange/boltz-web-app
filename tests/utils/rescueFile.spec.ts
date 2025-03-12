import {
    deriveKey,
    generateRescueFile,
    getXpub,
    validateRescueFile,
} from "../../src/utils/rescueFile";
import { RescueFile } from "../../src/utils/rescueFile";

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
        `("should derive a key at specified index", ({ index, expected }) => {
            const derivedKey = deriveKey(rescueFile, index);

            expect(derivedKey).toBeDefined();
            expect(derivedKey.privateKey).toBeDefined();
            expect(Buffer.from(derivedKey.privateKey).toString("hex")).toEqual(
                expected,
            );
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

            expect(() => validateRescueFile(data)).toThrow(
                "invalid rescue file",
            );
        });

        test("should throw error if mnemonic is invalid", () => {
            const data = {
                mnemonic: "invalid",
            };

            expect(() => validateRescueFile(data)).toThrow("invalid mnemonic");
        });
    });
});
