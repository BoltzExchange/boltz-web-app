import { sha256 } from "@noble/hashes/sha2.js";
import { HDKey } from "@scure/bip32";
import {
    generateMnemonic,
    mnemonicToSeedSync,
    validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

import { type AssetType, RBTC } from "./assets";

/** A rescue file containing a BIP-39 mnemonic used to derive swap keys. */
export type RescueFile = {
    mnemonic: string;
};

/** BIP-44 derivation path prefix for Bitcoin / Liquid keys. */
export const derivationPath = "m/44/0/0/0";

/** BIP-44 derivation path prefix for Rootstock keys. */
export const rskDerivationPath = "m/44/137/0/0";

/**
 * Build a full derivation path for a BTC/Liquid key at the given index.
 *
 * @param index - Child key index.
 * @returns The full derivation path string.
 */
const getPath = (index: number) => `${derivationPath}/${index}`;

/**
 * Build a full derivation path for a Rootstock key at the given index.
 *
 * @param index - Child key index.
 * @returns The full derivation path string.
 */
const getRskPath = (index: number) => `${rskDerivationPath}/${index}`;

/**
 * Convert a BIP-39 mnemonic to an HDKey master node.
 *
 * @param mnemonic - BIP-39 mnemonic phrase.
 * @returns The HD master key.
 */
export const mnemonicToHDKey = (mnemonic: string) => {
    const seed = mnemonicToSeedSync(mnemonic);
    return HDKey.fromMasterSeed(seed);
};

/**
 * Derive the extended public key (xpub) from a rescue file.
 *
 * @param rescueFile - The rescue file containing the mnemonic.
 * @returns The base58-encoded extended public key.
 */
export const getXpub = (rescueFile: RescueFile) => {
    return mnemonicToHDKey(rescueFile.mnemonic).publicExtendedKey;
};

/**
 * Generate a new rescue file with a fresh BIP-39 mnemonic.
 *
 * @returns A new {@link RescueFile}.
 */
export const generateRescueFile = (): RescueFile => ({
    mnemonic: generateMnemonic(wordlist),
});

/**
 * Derive a child key from a rescue file at the given index.
 *
 * Uses the Rootstock derivation path for RBTC and the standard path
 * for all other assets.
 *
 * @param rescueFile - The rescue file containing the mnemonic.
 * @param index - Child key index.
 * @param asset - Asset type (determines derivation path).
 * @param hdKey - Optional pre-computed HDKey to skip mnemonic decoding.
 * @returns The derived {@link HDKey}.
 */
export const deriveKey = (
    rescueFile: RescueFile,
    index: number,
    asset: AssetType,
    hdKey?: HDKey,
) => {
    const derivationPath = asset === RBTC ? getRskPath(index) : getPath(index);
    if (!hdKey) {
        return mnemonicToHDKey(rescueFile.mnemonic).derive(derivationPath);
    }
    return hdKey.derive(derivationPath);
};

/**
 * Validate that a plain object is a valid rescue file.
 *
 * Checks for the presence of a valid BIP-39 mnemonic and verifies
 * that an xpub can be derived.
 *
 * @param data - The object to validate.
 * @returns The validated {@link RescueFile}.
 * @throws `"invalid file"` if `mnemonic` is missing.
 * @throws `"invalid mnemonic"` if the mnemonic is invalid.
 */
export const validateRescueFile = (
    data: Record<string, string | object | number | boolean>,
): RescueFile => {
    if (!("mnemonic" in data)) {
        throw "invalid file";
    }

    if (!validateMnemonic(data.mnemonic as string, wordlist)) {
        throw "invalid mnemonic";
    }

    getXpub(data as RescueFile);

    return data as RescueFile;
};

/**
 * Derive a swap preimage by hashing the private key at the given index.
 *
 * The preimage is `SHA-256(privateKey)` where `privateKey` is derived from
 * the rescue file at `keyIndex`.
 *
 * @param rescueKey - The rescue file.
 * @param keyIndex - Derivation index for the key.
 * @param asset - Asset type (determines derivation path).
 * @param hdKey - Optional pre-computed HDKey.
 * @returns The 32-byte SHA-256 preimage.
 * @throws If the private key cannot be derived.
 */
export const derivePreimageFromRescueKey = (
    rescueKey: RescueFile,
    keyIndex: number,
    asset: AssetType,
    hdKey?: HDKey,
): Uint8Array => {
    const privateKey = deriveKey(rescueKey, keyIndex, asset, hdKey).privateKey;
    if (!privateKey) {
        throw new Error("failed to derive private key for preimage");
    }

    return sha256(privateKey);
};
