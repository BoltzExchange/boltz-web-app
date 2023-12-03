import { crypto, script } from "bitcoinjs-lib";
import { Scripts, reverseSwapScript, swapScript } from "boltz-core";
import { deployedBytecode as EtherSwapBytecode } from "boltz-core/out/EtherSwap.sol/EtherSwap.json";
import { Buffer, Buffer as BufferBrowser } from "buffer";
import { BaseContract } from "ethers";
import log from "loglevel";

import { decodeAddress, getAddress, getNetwork } from "../compat";
import { RBTC } from "../consts";
import { ECPair, ecc } from "../ecpair/ecpair";
import t from "../i18n";
import { denominations, formatAmountDenomination } from "./denomination";
import {
    decodeInvoice,
    isInvoice,
    isLnurl,
    trimLightningPrefix,
} from "./invoice";

// TODO: sanity check timeout block height?
// TODO: buffers for amounts

type SwapResponse = {
    reverse: boolean;

    asset: string;
    invoice: string;
    timeoutBlockHeight: number;

    sendAmount: number;
    receiveAmount: number;

    onchainAmount?: number;
    expectedAmount?: number;

    bip21?: string;
    address?: string;
    preimage?: string;
    privateKey?: string;
    redeemScript?: string;
    lockupAddress?: string;
};

type SwapResponseLiquid = SwapResponse & {
    blindingKey: string;
};

type ContractGetter = () => Promise<BaseContract>;

const validateContract = async (getEtherSwap: ContractGetter) => {
    const code = await (await getEtherSwap()).getDeployedCode();
    const codeMatches = code === EtherSwapBytecode.object;

    if (!codeMatches) {
        log.warn("contract validation: code mismatch");
    }

    // TODO: actually verify the code match
    // This check is currently disabled, because it mismatches on RSK, because it was compiled for a different EVM target
    return true;
};

const getScriptHashFunction = (isNativeSegwit: boolean) =>
    isNativeSegwit ? Scripts.p2wshOutput : Scripts.p2shP2wshOutput;

const validateAddress = (
    swap: SwapResponse,
    isNativeSegwit: boolean,
    address: string,
    buffer: BufferConstructor,
) => {
    const compareScript = getScriptHashFunction(isNativeSegwit)(
        buffer.from(swap.redeemScript, "hex"),
    );
    const decodedAddress = decodeAddress(swap.asset, address);

    if (!decodedAddress.script.equals(compareScript)) {
        return false;
    }

    if (swap.asset === "L-BTC") {
        const blindingPrivateKey = buffer.from(
            (swap as SwapResponseLiquid).blindingKey,
            "hex",
        );
        const blindingPublicKey = buffer.from(
            ecc.pointFromScalar(blindingPrivateKey),
        );

        if (!blindingPublicKey.equals(decodedAddress.blindingKey)) {
            log.warn("swap address validation: invalid Liquid blinding key");
            return false;
        }
    }

    return true;
};

const validateReverseSwap = async (
    swap: SwapResponse,
    getEtherSwap: ContractGetter,
    buffer: BufferConstructor,
) => {
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

    if (swap.asset === RBTC) {
        return await validateContract(getEtherSwap);
    }

    // Redeem script
    const redeemScript = buffer.from(swap.redeemScript, "hex");
    const compareRedeemScript = reverseSwapScript(
        preimageHash,
        ECPair.fromPrivateKey(buffer.from(swap.privateKey, "hex")).publicKey,
        script.decompile(redeemScript)[13] as Buffer,
        swap.timeoutBlockHeight,
    );

    if (!redeemScript.equals(compareRedeemScript)) {
        log.warn("reverse swap validation: redeem script");
        return false;
    }

    return validateAddress(swap, true, swap.lockupAddress, buffer);
};

const validateSwap = async (
    swap: SwapResponse,
    getEtherSwap: ContractGetter,
    buffer: BufferConstructor,
) => {
    // Amounts
    if (swap.expectedAmount !== swap.sendAmount) {
        return false;
    }

    if (swap.asset === RBTC) {
        return await validateContract(getEtherSwap);
    }

    // Redeem script
    const invoiceData = decodeInvoice(swap.invoice);

    const redeemScript = buffer.from(swap.redeemScript, "hex");
    const compareRedeemScript = swapScript(
        buffer.from(invoiceData.preimageHash, "hex"),
        script.decompile(redeemScript)[4] as Buffer,
        ECPair.fromPrivateKey(buffer.from(swap.privateKey, "hex")).publicKey,
        swap.timeoutBlockHeight,
    );

    if (!redeemScript.equals(compareRedeemScript)) {
        return false;
    }

    // Address
    const addressComparisons = [true, false].map((isNativeSegwit) =>
        validateAddress(swap, isNativeSegwit, swap.address, buffer),
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
export const validateResponse = async (
    swap: SwapResponse,
    getEtherSwap: ContractGetter,
    buffer: BufferConstructor = BufferBrowser,
) => {
    try {
        return await (swap.reverse
            ? validateReverseSwap(swap, getEtherSwap, buffer)
            : validateSwap(swap, getEtherSwap, buffer));
    } catch (e) {
        log.warn("swap validation threw", e);
        return false;
    }
};

export const validateOnchainAddress = (inputValue: string, asset: string) => {
    const address = getAddress(asset);
    address.toOutputScript(inputValue, getNetwork(asset));
    return inputValue;
};

export const validateInvoice = (inputValue: string) => {
    inputValue = trimLightningPrefix(inputValue);
    const isInputInvoice = isInvoice(inputValue);
    if (isLnurl(inputValue) || isInputInvoice) {
        // set receive/send when invoice differs from the amounts
        if (isInputInvoice) {
            const decoded = decodeInvoice(inputValue);
            if (decoded.satoshis === null) {
                throw new Error(t("invalid_0_amount"));
            }
            return decoded.satoshis;
        }
    }
    throw new Error(t("invalid_invoice"));
};
