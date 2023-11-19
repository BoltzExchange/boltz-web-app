import { crypto, script } from "bitcoinjs-lib";
import { Scripts, reverseSwapScript, swapScript } from "boltz-core";
import { Buffer as BufferBrowser } from "buffer";
import log from "loglevel";

import { decodeAddress, secp, setup } from "../compat";
import { ECPair } from "../ecpair/ecpair";
import { denominations, formatAmountDenomination } from "./denomination";
import { decodeInvoice } from "./invoice";

// TODO: sanity check timeout block height?
// TODO: buffers for amounts

const getScriptHashFunction = (isNativeSegwit) =>
    isNativeSegwit ? Scripts.p2wshOutput : Scripts.p2shP2wshOutput;

const validateAddress = async (swap, isNativeSegwit, address, buffer) => {
    const compareScript = getScriptHashFunction(isNativeSegwit)(
        buffer.from(swap.redeemScript, "hex"),
    );
    const decodedAddress = decodeAddress(swap.asset, address);

    if (!decodedAddress.script.equals(compareScript)) {
        return false;
    }

    if (swap.asset === "L-BTC") {
        await setup();

        const blindingPrivateKey = buffer.from(swap.blindingKey, "hex");
        const blindingPublicKey = buffer.from(
            secp.ecc.pointFromScalar(blindingPrivateKey),
        );

        if (!blindingPublicKey.equals(decodedAddress.blindingKey)) {
            log.warn("swap address validation: invalid Liquid blinding key");
            return false;
        }
    }

    return true;
};

const validateReverseSwap = (swap, buffer) => {
    const invoiceData = decodeInvoice(swap.invoice);

    // Amounts
    if (
        invoiceData.satoshis !== swap.sendAmount ||
        swap.onchainAmount <= swap.receiveAmount
    ) {
        log.warn("reverse swap validation: amounts");
        return false;
    }

    // Invoice
    const preimageHash = crypto.sha256(buffer.from(swap.preimage, "hex"));
    if (invoiceData.preimageHash !== preimageHash.toString("hex")) {
        log.warn("reverse swap validation: preimage hash");
        return false;
    }

    // Redeem script
    const redeemScript = buffer.from(swap.redeemScript, "hex");
    const compareRedeemScript = reverseSwapScript(
        preimageHash,
        ECPair.fromPrivateKey(buffer.from(swap.privateKey, "hex")).publicKey,
        script.decompile(redeemScript)[13],
        swap.timeoutBlockHeight,
    );

    if (!redeemScript.equals(compareRedeemScript)) {
        log.warn("reverse swap validation: redeem script");
        return false;
    }

    return validateAddress(swap, true, swap.lockupAddress, buffer);
};

const validateSwap = async (swap, buffer) => {
    const invoiceData = decodeInvoice(swap.invoice);

    // Amounts
    if (swap.expectedAmount !== swap.sendAmount) {
        return false;
    }

    // Redeem script
    const redeemScript = buffer.from(swap.redeemScript, "hex");
    const compareRedeemScript = swapScript(
        buffer.from(invoiceData.preimageHash, "hex"),
        script.decompile(redeemScript)[4],
        ECPair.fromPrivateKey(buffer.from(swap.privateKey, "hex")).publicKey,
        swap.timeoutBlockHeight,
    );

    if (!redeemScript.equals(compareRedeemScript)) {
        return false;
    }

    // Address
    const addressComparisons = await Promise.all(
        [true, false].map((isNativeSegwit) =>
            validateAddress(swap, isNativeSegwit, swap.address, buffer),
        ),
    );
    if (addressComparisons.every((val) => !val)) {
        log.warn("swap address validation: address script mismatch");
        return false;
    }

    // BIP-21
    const bip21Split = swap.bip21.split("?");
    if (bip21Split[0].split(":")[1] !== swap.address) {
        return false;
    }

    return (
        new URLSearchParams(bip21Split[1]).get("amount") ===
        formatAmountDenomination(denominations.btc, swap.sendAmount)
    );
};

// To be able to use the Buffer from Node.js
export const validateResponse = async (swap, buffer = BufferBrowser) => {
    try {
        return await (swap.reverse
            ? validateReverseSwap(swap, buffer)
            : validateSwap(swap, buffer));
    } catch (e) {
        log.warn("swap validation threw", e);
        return false;
    }
};
