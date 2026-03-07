import { sha256 } from "@noble/hashes/sha2.js";
import { HDKey } from "@scure/bip32";
import {
    generateMnemonic,
    mnemonicToSeedSync,
    validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

import { type AssetType, isEvmAsset } from "./assets";
import { getConfig } from "./config";

/** Error messages thrown during rescue file validation. */
export enum Errors {
    InvalidFile = "invalid file",
    NotAllElementsHaveAnId = "not all elements have an id",
    InvalidMnemonic = "invalid mnemonic",
}

/** A rescue file containing a BIP-39 mnemonic used to derive swap keys. */
export type RescueFile = {
    mnemonic: string;
};

/** BIP-44 derivation path prefix for Bitcoin / Liquid keys. */
export const derivationPath = "m/44/0/0/0";

/**
 * Build an EVM BIP-44 derivation path prefix for a given chain ID.
 *
 * @param chainId - EVM chain ID (e.g. 31 for RSK).
 */
export const evmPath = (chainId: number) => `m/44/${chainId}/0/0`;

const getPath = (index: number) => `${derivationPath}/${index}`;

const getEvmPath = (chainId: number, index: number) =>
    `${evmPath(chainId)}/${index}`;

const getPathGasAbstraction = (chainId: number) => `m/44/${chainId}/1/0`;

/**
 * Convert a BIP-39 mnemonic to an HDKey master node.
 *
 * @param mnemonic - BIP-39 mnemonic phrase.
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

/** Generate a new rescue file with a fresh BIP-39 mnemonic. */
export const generateRescueFile = (): RescueFile => ({
    mnemonic: generateMnemonic(wordlist),
});

/**
 * Derive a child key from a rescue file at the given index.
 *
 * Uses the EVM derivation path (based on chain ID) for EVM assets
 * and the standard BIP-44 path for all others.
 *
 * @param rescueFile - The rescue file containing the mnemonic.
 * @param index - Child key index.
 * @param asset - Asset identifier (determines derivation path).
 * @param hdKey - Optional pre-computed HDKey to skip mnemonic decoding.
 */
export const deriveKey = (
    rescueFile: RescueFile,
    index: number,
    asset: AssetType,
    hdKey?: HDKey,
) => {
    const assetConfig = getConfig().assets?.[asset];
    const derivationPath =
        isEvmAsset(asset) && assetConfig?.network
            ? getEvmPath(assetConfig.network.chainId, index)
            : getPath(index);

    if (!hdKey) {
        return mnemonicToHDKey(rescueFile.mnemonic).derive(derivationPath);
    }
    return hdKey.derive(derivationPath);
};

/**
 * Derive the gas-abstraction signer key for an EVM chain.
 *
 * @param rescueFile - The rescue file containing the mnemonic.
 * @param chainId - EVM chain ID.
 */
export const deriveKeyGasAbstraction = (
    rescueFile: RescueFile,
    chainId: number,
) => {
    return mnemonicToHDKey(rescueFile.mnemonic).derive(
        getPathGasAbstraction(chainId),
    );
};

/**
 * Validate that a plain object is a valid rescue file.
 *
 * @param data - The object to validate.
 * @returns The validated {@link RescueFile}.
 * @throws If `mnemonic` is missing or invalid.
 */
export const validateRescueFile = (
    data: Record<string, string | object | number | boolean>,
): RescueFile => {
    if (!("mnemonic" in data)) {
        throw new Error(Errors.InvalidFile);
    }

    if (!validateMnemonic(data.mnemonic as string, wordlist)) {
        throw new Error(Errors.InvalidMnemonic);
    }

    getXpub(data as RescueFile);

    return data as RescueFile;
};

/**
 * Derive a swap preimage by SHA-256 hashing the private key at the given index.
 *
 * @param rescueKey - The rescue file.
 * @param keyIndex - Derivation index for the key.
 * @param asset - Asset identifier (determines derivation path).
 * @param hdKey - Optional pre-computed HDKey.
 * @returns The 32-byte SHA-256 preimage.
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
