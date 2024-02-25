import { Buffer } from "buffer";
import { ECPairInterface } from "ecpair";

import { ECPair } from "./ecpair";

export const parseBlindingKey = (swap: { blindingKey: string | undefined }) => {
    return swap.blindingKey ? Buffer.from(swap.blindingKey, "hex") : undefined;
};

export const parsePrivateKey = (privateKey: string): ECPairInterface => {
    try {
        return ECPair.fromPrivateKey(Buffer.from(privateKey, "hex"));
    } catch (e) {
        // When the private key is not HEX, we try to decode it as WIF
        return ECPair.fromWIF(privateKey);
    }
};
