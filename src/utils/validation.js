import bolt11 from "bolt11";
import log from "loglevel";
import { crypto, script } from "bitcoinjs-lib";
import { Scripts, reverseSwapScript } from "boltz-core";
import { ECPair } from "../ecpair/ecpair";
import { decodeAddress } from "../compat";

// TODO: sanity check timeout block height?

export const decodeInvoice = (invoice) => {
    const decoded = bolt11.decode(invoice);
    return {
        satoshis: decoded.satoshis,
        preimageHash: decoded.tags.find((tag) => tag.tagName === "payment_hash")
            .data,
    };
};

const validateReverseSwap = (swap) => {
    const invoiceData = decodeInvoice(swap.invoice);

    // Amounts
    if (
        invoiceData.satoshis !== swap.sendAmount ||
        swap.onchainAmount !== swap.receiveAmount
    ) {
        return false;
    }

    // Invoice
    const preimageHash = crypto.sha256(Buffer.from(swap.preimage, "hex"));

    if (invoiceData.preimageHash !== preimageHash.toString("hex")) {
        return false;
    }

    // Redeem script
    const redeemScript = Buffer.from(swap.redeemScript, "hex");
    const compareRedeemScript = reverseSwapScript(
        preimageHash,
        ECPair.fromPrivateKey(Buffer.from(swap.privateKey, "hex")).publicKey,
        script.decompile(redeemScript)[13],
        swap.timeoutBlockHeight
    );

    if (!redeemScript.equals(compareRedeemScript)) {
        return false;
    }

    // Address
    const compareScript = Scripts.p2wshOutput(compareRedeemScript);
    const decodedAddress = decodeAddress(swap.asset, swap.lockupAddress);

    if (!decodedAddress.script.equals(compareScript)) {
        return false;
    }

    // TODO: valid blinding key on liquid

    return true;
};

export const validateResponse = (swap) => {
    try {
        if (swap.reverse) {
            return validateReverseSwap(swap);
        } else {
            const output = Scripts.p2shP2wshOutput(
                Buffer.from(swap.redeemScript, "hex")
            );
            console.log(output);
            if (swap.sendAmount === swap.expectedAmount) {
                valid = true;
            }
        }
        return valid;
    } catch (e) {
        console.log(e);
        log.debug("swap validation threw", e);
        return false;
    }
};
