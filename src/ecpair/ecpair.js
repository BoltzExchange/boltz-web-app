import { ECPairFactory } from "ecpair";
import { initEccLib } from 'bitcoinjs-lib';
import * as ecc from './noble';
import { initEccLib as initEccLibLiquid } from 'liquidjs-lib';
import * as eccLiquid from '@vulpemventures/secp256k1-zkp';

const getECPair = (asset) => {
    initEccLib(ecc);
    return ECPairFactory(ecc);
    // if (asset === "BTC") {
    // }
    // if (asset === "L-BTC") {
    //     initEccLibLiquid(eccLiquid);
    //     return ECPairFactory(eccLiquid);
    // }
}

export { getECPair };
