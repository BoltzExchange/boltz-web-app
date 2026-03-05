import { secp256k1 } from "@noble/curves/secp256k1.js";
import { WIF } from "@scure/btc-signer";

export interface ECKeys {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
}

/**
 * Derive the compressed public key from a raw private key.
 *
 * @param privateKey - 32-byte secp256k1 private key.
 * @returns An {@link ECKeys} pair.
 */
const fromPrivateKey = (privateKey: Uint8Array): ECKeys => ({
    privateKey,
    publicKey: secp256k1.getPublicKey(privateKey, true),
});

/**
 * Decode a WIF-encoded private key and derive the corresponding key pair.
 *
 * @param wif - Wallet Import Format string.
 * @returns An {@link ECKeys} pair.
 */
const fromWIF = (wif: string): ECKeys => {
    const privateKey = WIF().decode(wif);
    return fromPrivateKey(privateKey);
};

/**
 * Factory for creating secp256k1 key pairs.
 */
export const ECPair = {
    fromPrivateKey,
    fromWIF,
};
