import lightningPayReq from "bolt11";
import { crypto } from "bitcoinjs-lib";
import { Scripts, swapScript, reverseSwapScript } from "boltz-core";

export const validateResponse = (swap) => {
    let valid = false;
    if (swap.reverse) {
        const decoded = lightningPayReq.decode(swap.invoice);
        let preimage = Buffer.from(swap.preimage, "hex");
        let preimageHash = crypto.sha256(preimage);
        let preimageHashHex = preimageHash.toString("hex");
        let paymentHashTag = decoded.tags.find(
            (tag) => tag.tagName === "payment_hash"
        );
        if (
            paymentHashTag.data === preimageHashHex &&
            decoded.satoshis === swap.sendAmount
        ) {
            valid = true;
        }
    } else {
        const output = Scripts.p2shP2wshOutput(Buffer.from(swap.redeemScript, "hex"));
        console.log(output);
        if (swap.sendAmount === swap.expectedAmount) {
            valid = true;
        }
    }
    return valid;
};
