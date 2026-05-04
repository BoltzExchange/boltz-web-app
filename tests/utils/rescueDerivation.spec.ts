import { hex } from "@scure/base";
import { publicKeyToAddress } from "viem/accounts";

import {
    derivePreimage,
    evmAccountFromPrivateKey,
    evmPath,
    mnemonicToHDKey,
} from "../../src/utils/rescueDerivation";
import {
    deriveKeyGasAbstraction,
    getPathGasAbstraction,
} from "../../src/utils/rescueFile";

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

    describe("evmAccountFromPrivateKey", () => {
        const ethersFixtures = [
            {
                label: "BIP-39 abandon * 11/about + chainId 137 (Polygon)",
                mnemonic:
                    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
                chainId: 137,
                expected: "0x779da8bca26ca2352eC148C64649db1d1A98DEDf",
            },
            {
                label: "BIP-39 'legal winner…' 12-word + chainId 30 (RSK mainnet)",
                mnemonic:
                    "legal winner thank year wave sausage worth useful legal winner thank yellow",
                chainId: 30,
                expected: "0x3d44290a025BBEaAbd4d4Ef0Fef8dfcBf7662b71",
            },
            {
                label: "BIP-39 'legal winner…' 24-word + chainId 1 (Ethereum mainnet)",
                mnemonic:
                    "legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title",
                chainId: 1,
                expected: "0xF9F7340F1EF65484E0e626ea7A563E95d75E2De7",
            },
        ];

        const fixtureMnemonic = ethersFixtures[0].mnemonic;
        const fixtureChainId = ethersFixtures[0].chainId;
        const fixtureAddress = ethersFixtures[0].expected;

        test.each(ethersFixtures)(
            "matches ethers `computeAddress` (origin/main) for $label",
            ({ mnemonic: m, chainId, expected }) => {
                const gasKey = mnemonicToHDKey(m).derive(
                    getPathGasAbstraction(chainId),
                );

                expect(
                    evmAccountFromPrivateKey(gasKey.privateKey).address,
                ).toBe(expected);
            },
        );

        test("differs from the (incorrect) compressed-pubkey-based derivation", () => {
            const gasKey = mnemonicToHDKey(fixtureMnemonic).derive(
                getPathGasAbstraction(fixtureChainId),
            );

            const correctAddress = evmAccountFromPrivateKey(
                gasKey.privateKey,
            ).address;
            const buggyAddress = publicKeyToAddress(
                `0x${hex.encode(gasKey.publicKey!)}`,
            );

            expect(correctAddress).not.toBe(buggyAddress);
            expect(buggyAddress).toBe(
                "0x8664786c89ee296283103724bec9Fc5837A7B66b",
            );
        });

        test("Web3.tsx and RescueExternal.tsx derive the same address for the same mnemonic + chainId", () => {
            const rescueFile = { mnemonic: fixtureMnemonic };

            const web3Address = evmAccountFromPrivateKey(
                deriveKeyGasAbstraction(rescueFile, fixtureChainId).privateKey,
            ).address;

            const rescueScanAddress = evmAccountFromPrivateKey(
                mnemonicToHDKey(fixtureMnemonic).derive(
                    getPathGasAbstraction(fixtureChainId),
                ).privateKey,
            ).address;

            expect(web3Address).toBe(rescueScanAddress);
            expect(web3Address).toBe(fixtureAddress);
        });

        test("throws when the private key is missing", () => {
            expect(() => evmAccountFromPrivateKey(null)).toThrow(
                "missing private key for EVM account derivation",
            );
            expect(() => evmAccountFromPrivateKey(undefined)).toThrow(
                "missing private key for EVM account derivation",
            );
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
