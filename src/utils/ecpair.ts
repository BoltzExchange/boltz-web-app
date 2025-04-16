import ecc from "@bitcoinerlab/secp256k1";
import { initEccLib } from "bitcoinjs-lib";
import type { ECPairAPI } from "ecpair";
import { ECPairFactory } from "ecpair";

let ECPair: ECPairAPI;

export const initEcc = () => {
    initEccLib(ecc);
    ECPair = ECPairFactory(ecc);
};

export { ECPair, ecc };
