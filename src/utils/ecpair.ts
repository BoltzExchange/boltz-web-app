import { secp256k1 } from "@noble/curves/secp256k1.js";
import { WIF } from "@scure/btc-signer";

export interface ECKeys {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
}

const fromPrivateKey = (privateKey: Uint8Array): ECKeys => ({
    privateKey,
    publicKey: secp256k1.getPublicKey(privateKey, true),
});

const fromWIF = (wif: string): ECKeys => {
    const privateKey = WIF().decode(wif);
    return fromPrivateKey(privateKey);
};

export const ECPair = {
    fromPrivateKey,
    fromWIF,
};
