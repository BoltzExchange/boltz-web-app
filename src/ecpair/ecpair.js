import { ECPairFactory } from "ecpair";
import * as ecc from './noble';

const ECPair = ECPairFactory(ecc);

export { ECPair };
