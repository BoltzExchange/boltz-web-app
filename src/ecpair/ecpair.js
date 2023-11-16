import ecc from "@bitcoinerlab/secp256k1";
import { initEccLib } from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";

initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export { ECPair };
