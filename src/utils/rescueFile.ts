import type { HDKey } from "@scure/bip32";
import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

import { config } from "../config";
import { type AssetType, isEvmAsset } from "../consts/Assets";
import { derivePreimage, evmPath, mnemonicToHDKey } from "./rescueDerivation";

export enum Errors {
    InvalidFile = "invalid file",
    NotAllElementsHaveAnId = "not all elements have an id",
    InvalidMnemonic = "invalid mnemonic",
}

export type RescueFile = {
    mnemonic: string;
};

export const derivationPath = "m/44/0/0/0";

const getPath = (index: number) => `${derivationPath}/${index}`;

const getEvmPath = (chainId: number, index: number) =>
    `${evmPath(chainId)}/${index}`;

export const getPathGasAbstraction = (chainId: number) => `m/44/${chainId}/1/0`;

export const getXpub = (rescueFile: RescueFile) => {
    return mnemonicToHDKey(rescueFile.mnemonic).publicExtendedKey;
};

export const generateRescueFile = (): RescueFile => ({
    mnemonic: generateMnemonic(wordlist),
});

export const deriveKey = (
    rescueFile: RescueFile,
    index: number,
    asset: AssetType,
    hdKey?: HDKey,
) => {
    let derivationPath: string;
    if (isEvmAsset(asset)) {
        const chainId = config.assets?.[asset]?.network?.chainId;
        if (chainId === undefined) {
            throw new Error(`missing chainId for EVM asset ${asset}`);
        }
        derivationPath = getEvmPath(chainId, index);
    } else {
        derivationPath = getPath(index);
    }

    if (!hdKey) {
        return mnemonicToHDKey(rescueFile.mnemonic).derive(derivationPath);
    }
    return hdKey.derive(derivationPath);
};

export const deriveKeyGasAbstraction = (
    rescueFile: RescueFile,
    chainId: number,
) => {
    return mnemonicToHDKey(rescueFile.mnemonic).derive(
        getPathGasAbstraction(chainId),
    );
};

export const validateRescueFile = (
    data: Record<string, string | object | number | boolean>,
): RescueFile => {
    if (!("mnemonic" in data)) {
        throw Errors.InvalidFile;
    }

    if (!validateMnemonic(data.mnemonic as string, wordlist)) {
        throw Errors.InvalidMnemonic;
    }

    getXpub(data as RescueFile);

    return data as RescueFile;
};

export const derivePreimageFromRescueKey = (
    rescueKey: RescueFile,
    keyIndex: number,
    asset: AssetType,
    hdKey?: HDKey,
): Buffer => {
    const privateKey = deriveKey(rescueKey, keyIndex, asset, hdKey).privateKey;
    if (privateKey === null) {
        throw new Error("missing private key for preimage derivation");
    }

    return Buffer.from(derivePreimage(privateKey));
};
