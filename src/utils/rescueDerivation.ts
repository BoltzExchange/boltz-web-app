import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { type PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

export const evmPath = (chainId: number) => `m/44/${chainId}/0/0`;

export const mnemonicToHDKey = (mnemonic: string) => {
    const seed = mnemonicToSeedSync(mnemonic);
    return HDKey.fromMasterSeed(seed);
};

export const derivePreimage = (privateKey: Uint8Array): Uint8Array => {
    if (privateKey === null) {
        throw new Error("failed to derive private key");
    }

    return sha256(privateKey);
};

export const evmAccountFromPrivateKey = (
    privateKey: Uint8Array | null | undefined,
): PrivateKeyAccount => {
    if (privateKey == null) {
        throw new Error("missing private key for EVM account derivation");
    }
    return privateKeyToAccount(`0x${hex.encode(privateKey)}`);
};
