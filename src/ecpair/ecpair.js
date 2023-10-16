import { ECPairFactory } from "ecpair";
import ecc from "@bitcoinerlab/secp256k1";
import { initEccLib } from "bitcoinjs-lib";

initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export { ECPair };
