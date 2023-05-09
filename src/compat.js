import { network } from "./config";
import { address, networks, Transaction } from 'bitcoinjs-lib';
import { address as l_address, networks as l_networks, Transaction as l_Transaction, confidential } from "liquidjs-lib";
import { constructClaimTransaction, constructRefundTransaction, detectSwap } from "boltz-core";
import { constructClaimTransaction as lcCT, constructRefundTransaction as lcRT, detectSwap as ldS } from "boltz-core-liquid-michael1011";

const getAddress = (asset) => {
    if (asset === "L-BTC") {
        return l_address;
    } else {
        return address;
    }
}

const getNetwork = (asset) => {
    if (asset === "L-BTC") {
        return l_networks[network];
    } else {
        return networks[network];
    }
}

const getTransaction = (asset) => {
    if (asset === "L-BTC") {
        return l_Transaction;
    } else {
        return Transaction;
    }
}

const getConstructClaimTransaction = (asset) => {
    if (asset === "L-BTC") {
        return lcCT;
    } else {
        return constructClaimTransaction;
    }
}

const getConstructRefundTransaction = (asset) => {
    if (asset === "L-BTC") {
        return lcRT;
    } else {
        return constructRefundTransaction;
    }
}

const getDetectSwap = (asset) => {
    if (asset === "L-BTC") {
        return ldS;
    } else {
        return detectSwap;
    }
}

const getOutputAmount = (asset, output) => {
    return asset === "L-BTC" ?
        confidential.confidentialValueToSatoshi(output.value) :
        output.value;
}


export {
    getAddress,
    getNetwork,
    getDetectSwap,
    getTransaction,
    getOutputAmount,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
};
