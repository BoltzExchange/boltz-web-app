import zkp from '@vulpemventures/secp256k1-zkp';
import { address, networks, Transaction } from "bitcoinjs-lib";
import {
    address as l_address,
    networks as l_networks,
    Transaction as l_Transaction,
    confidential,
} from "liquidjs-lib";
import {
    constructClaimTransaction,
    constructRefundTransaction,
    detectSwap,
} from "boltz-core";
import {
    constructClaimTransaction as lcCT,
    constructRefundTransaction as lcRT,
    detectSwap as ldS,
    targetFee,
    prepareConfidential,
} from "boltz-core-liquid-michael1011";
import { network } from "./config";

let confi;

const setup = async () => {
    if (confi !== undefined) {
        return;
    }

    const zkpLib = await zkp();
    confi = new confidential.Confidential(zkpLib);
    prepareConfidential(zkpLib);
};

const getAddress = (asset) => {
    if (asset === "L-BTC") {
        return l_address;
    } else {
        return address;
    }
};

const decodeAddress = (asset, addr) => {
    const address = getAddress(asset);
    if (asset === "L-BTC") {
        // This throws for unconfidential addresses -> fallback to output script decoding
        try {
            const decoded = address.fromConfidential(addr);
    
            return {
                script: decoded.scriptPubKey,
                blindingKey: decoded.blindingKey,
            };
        } catch (e) {}
    }

    return {
        script: address.toOutputScript(addr, getNetwork(asset)),
    };
};

const getNetwork = (asset) => {
    if (asset === "L-BTC") {
        const liquidNet = network === "main" ? "liquid" : network;
        return l_networks[liquidNet];
    } else {
        return networks[network];
    }
};

const getTransaction = (asset) => {
    if (asset === "L-BTC") {
        return l_Transaction;
    } else {
        return Transaction;
    }
};

const getConstructClaimTransaction = (asset) => {
    if (asset === "L-BTC") {
        return lcCT;
    } else {
        return constructClaimTransaction;
    }
};

const getConstructRefundTransaction = (asset) => {
    if (asset === "L-BTC") {
        return (
            refundDetails,
            outputScript,
            timeoutBlockHeight,
            feePerVbyte,
            isRbf,
            assetHash,
            blindingKey
        ) =>
            targetFee(feePerVbyte, (fee) =>
                lcRT(
                    refundDetails,
                    outputScript,
                    timeoutBlockHeight,
                    fee,
                    isRbf,
                    assetHash,
                    blindingKey
                )
            );
    } else {
        return constructRefundTransaction;
    }
};

const getDetectSwap = (asset) => {
    if (asset === "L-BTC") {
        return ldS;
    } else {
        return detectSwap;
    }
};

const getOutputAmount = (asset, output) => {
    if (asset !== "L-BTC") {
        return output.value;
    }

    if (output.rangeProof?.length !== 0) {
        const unblinded = confi.unblindOutputWithKey(output, output.blindingPrivKey);
        return Number(unblinded.value);
    } else {
        return confidential.confidentialValueToSatoshi(output.value);
    }
};

export {
    setup,
    getAddress,
    getNetwork,
    decodeAddress,
    getDetectSwap,
    getTransaction,
    getOutputAmount,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
};
