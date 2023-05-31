import lightningPayReq from "bolt11";
import * as secp from "@noble/secp256k1";

export const validateResponse = async (swap) => {
    let valid = false;
    const decoded = lightningPayReq.decode(swap.invoice);

    let preimage = Buffer.from(swap.preimage, "hex");
    let preimageHash = await secp.utils.sha256(preimage);
    let preimageHashHex = secp.utils.bytesToHex(preimageHash);

    console.log(preimageHashHex);
    console.log(decoded.payment_hash);
    if (
        decoded.satoshis === swap.sendAmount &&
        decoded.satoshis === swap.sendAmount
    ) {
        valid = true;
    }
    console.log(valid);
    // if (decoded.payment_hash !== swap.preimage) {
    //     return false;
    // }

    return valid;
};
