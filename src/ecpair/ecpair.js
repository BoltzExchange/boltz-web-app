import { ECPairFactory } from "ecpair";
import { initEccLib } from 'bitcoinjs-lib';
import * as ecc from './noble';

initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export { ECPair };
