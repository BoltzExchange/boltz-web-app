import { HDKey } from "@scure/bip32";
import {
    generateMnemonic,
    mnemonicToSeedSync,
    validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { crypto } from "bitcoinjs-lib";

import { type AssetType, RBTC } from "../consts/Assets";

export enum Errors {
    InvalidFile = "invalid file",
    NotAllElementsHaveAnId = "not all elements have an id",
    InvalidMnemonic = "invalid mnemonic",
}

export type RescueFile = {
    mnemonic: string;
};

export const derivationPath = "m/44/0/0/0";
export const rskDerivationPath = "m/44/137/0/0";

const getPath = (index: number) => `${derivationPath}/${index}`;

const getRskPath = (index: number) => `${rskDerivationPath}/${index}`;

const getPathGasAbstraction = (chainId: number) => `m/44/${chainId}/0/0`;

export const mnemonicToHDKey = (mnemonic: string) => {
    const seed = mnemonicToSeedSync(mnemonic);
    return HDKey.fromMasterSeed(seed);
};

export const getXpub = (rescueFile: RescueFile) => {
    return mnemonicToHDKey(rescueFile.mnemonic).publicExtendedKey;
};

export const generateRescueFile = (): RescueFile => ({
    mnemonic: generateMnemonic(wordlist),
});

export const deriveKey = (
    rescueFile: RescueFile,
    index: number,
    // TODO: use chain id instaed of asset
    asset: AssetType,
    hdKey?: HDKey,
) => {
    const derivationPath = asset === RBTC ? getRskPath(index) : getPath(index);
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

    return crypto.sha256(Buffer.from(privateKey));
};
