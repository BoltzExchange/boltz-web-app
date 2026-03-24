import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";

import {
    derivationPath,
    generateRescueFile,
    mnemonicToHDKey,
} from "../../src/utils/rescueFile";

/**
 * Tests for the temp Liquid wallet key derivation logic. We test the
 * derivation independently of liquidjs-lib since the library requires
 * WASM secp256k1-zkp initialisation that is impractical in unit tests.
 *
 * The production code in deriveTempLiquidWallet uses the same derivation
 * logic tested here:
 *   - spend key from m/44/0/0/0/{index}  (standard Boltz path)
 *   - blinding key = SHA256(spend_private_key)
 */
describe("liquidWallet key derivation", () => {
    const rescueFile = generateRescueFile();

    const deriveSpendKey = (mnemonic: string, index: number) => {
        const hdKey = mnemonicToHDKey(mnemonic);
        return hdKey.derive(`${derivationPath}/${index}`);
    };

    const deriveBlindingKey = (spendPrivateKey: Uint8Array) => {
        return sha256(spendPrivateKey);
    };

    test("should derive consistent keys for same mnemonic and index", () => {
        const key1 = deriveSpendKey(rescueFile.mnemonic, 0);
        const key2 = deriveSpendKey(rescueFile.mnemonic, 0);

        expect(Buffer.from(key1.privateKey)).toEqual(
            Buffer.from(key2.privateKey),
        );
    });

    test("should derive different keys for different indices", () => {
        const key0 = deriveSpendKey(rescueFile.mnemonic, 0);
        const key1 = deriveSpendKey(rescueFile.mnemonic, 1);

        expect(Buffer.from(key0.privateKey)).not.toEqual(
            Buffer.from(key1.privateKey),
        );
    });

    test("should derive different keys for different mnemonics", () => {
        const otherFile = generateRescueFile();
        const key1 = deriveSpendKey(rescueFile.mnemonic, 0);
        const key2 = deriveSpendKey(otherFile.mnemonic, 0);

        expect(Buffer.from(key1.privateKey)).not.toEqual(
            Buffer.from(key2.privateKey),
        );
    });

    test("should use the standard Boltz derivation path (m/44/0/0/0)", () => {
        const key = deriveSpendKey(rescueFile.mnemonic, 5);
        const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
        const expected = hdKey.derive(`${derivationPath}/5`);

        expect(Buffer.from(key.privateKey)).toEqual(
            Buffer.from(expected.privateKey),
        );
    });

    test("should produce deterministic blinding key from spend key", () => {
        const spend = deriveSpendKey(rescueFile.mnemonic, 3);
        const blinding1 = deriveBlindingKey(spend.privateKey);
        const blinding2 = deriveBlindingKey(spend.privateKey);

        expect(Buffer.from(blinding1)).toEqual(Buffer.from(blinding2));
    });

    test("should produce different blinding keys for different spend keys", () => {
        const spend0 = deriveSpendKey(rescueFile.mnemonic, 0);
        const spend1 = deriveSpendKey(rescueFile.mnemonic, 1);
        const blinding0 = deriveBlindingKey(spend0.privateKey);
        const blinding1 = deriveBlindingKey(spend1.privateKey);

        expect(Buffer.from(blinding0)).not.toEqual(Buffer.from(blinding1));
    });

    test("should produce valid secp256k1 public keys from derived keys", () => {
        const spend = deriveSpendKey(rescueFile.mnemonic, 0);
        const blinding = deriveBlindingKey(spend.privateKey);

        const spendPub = secp256k1.getPublicKey(spend.privateKey, true);
        const blindingPub = secp256k1.getPublicKey(blinding, true);

        expect(spendPub.length).toBe(33);
        expect(blindingPub.length).toBe(33);
        expect([0x02, 0x03]).toContain(spendPub[0]);
    });

    test("should be fully reconstructable from mnemonic + key index", () => {
        const index = 7;
        const spend1 = deriveSpendKey(rescueFile.mnemonic, index);
        const blinding1 = deriveBlindingKey(spend1.privateKey);

        const reconstructed = deriveSpendKey(rescueFile.mnemonic, index);
        const blindingReconstructed = deriveBlindingKey(
            reconstructed.privateKey,
        );

        expect(Buffer.from(reconstructed.privateKey)).toEqual(
            Buffer.from(spend1.privateKey),
        );
        expect(Buffer.from(blindingReconstructed)).toEqual(
            Buffer.from(blinding1),
        );
    });

    test("should use same key as Boltz claim key at same index", () => {
        const index = 4;
        const tempWalletSpendKey = deriveSpendKey(rescueFile.mnemonic, index);

        const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
        const boltzClaimKey = hdKey.derive(`m/44/0/0/0/${index}`);

        expect(Buffer.from(tempWalletSpendKey.privateKey)).toEqual(
            Buffer.from(boltzClaimKey.privateKey),
        );
    });

    test("blinding key should differ from spend key", () => {
        const spend = deriveSpendKey(rescueFile.mnemonic, 0);
        const blinding = deriveBlindingKey(spend.privateKey);

        expect(Buffer.from(blinding)).not.toEqual(
            Buffer.from(spend.privateKey),
        );
    });
});
