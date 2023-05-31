import lightningPayReq from "bolt11";
import { crypto } from "bitcoinjs-lib";

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
        if (swap.sendAmount === swap.expectedAmount) {
            valid = true;
        }
    }
    return valid;
};
