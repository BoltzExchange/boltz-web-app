import { BigNumber } from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import {
    Scripts,
    SwapTreeSerializer,
    Types,
    reverseSwapTree,
    swapTree,
} from "boltz-core";
import { deployedBytecode as EtherSwapBytecode } from "boltz-core/out/EtherSwap.sol/EtherSwap.json";
import { Buffer, Buffer as BufferBrowser } from "buffer";
import { ECPairInterface } from "ecpair";
import { BaseContract } from "ethers";
import log from "loglevel";

import { RBTC } from "../consts";
import { decodeAddress, setup } from "./compat";
import { denominations, formatAmountDenomination } from "./denomination";
import { ECPair, ecc } from "./ecpair";
import { decodeInvoice, isInvoice, isLnurl } from "./invoice";
import { createMusig, tweakMusig } from "./taproot/musig";

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
    swapTree?: string;
    lockupAddress?: string;

    claimPublicKey?: string;
    refundPublicKey?: string;
};

type SwapResponseLiquid = SwapResponse & {
    blindingKey: string;
};

type ContractGetter = () => Promise<BaseContract>;

const compareTrees = (
    tree: Types.SwapTree,
    compare: Types.SwapTree,
): boolean => {
    const compareLeaf = (leaf: Types.Tapleaf, compareLeaf: Types.Tapleaf) =>
        leaf.version === compareLeaf.version &&
        leaf.output.equals(compareLeaf.output);

    return (tree.tree as Types.Tapleaf[]).every((leaf, i) =>
        compareLeaf(leaf, compare.tree[i] as Types.Tapleaf),
    );
};

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

const validateAddress = async (
    swap: SwapResponse,
    tree: Types.SwapTree,
    ourKeys: ECPairInterface,
    theirPublicKey: Buffer,
    address: string,
    buffer: BufferConstructor,
) => {
    await setup();
    const tweakedKey = tweakMusig(
        swap.asset,
        createMusig(ourKeys, theirPublicKey),
        tree.tree,
    );

    const compareScript = Scripts.p2trOutput(tweakedKey);
    const decodedAddress = decodeAddress(swap.asset, address);

    if (!decodedAddress.script.equals(compareScript)) {
        log.warn("address validation: invalid script");
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
            log.warn("address validation: invalid Liquid blinding key");
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

    // SwapTree
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = ECPair.fromPrivateKey(buffer.from(swap.privateKey, "hex"));
    const theirPublicKey = buffer.from(swap.refundPublicKey, "hex");

    const compareTree = reverseSwapTree(
        swap.asset === "L-BTC",
        preimageHash,
        ourKeys.publicKey,
        theirPublicKey,
        swap.timeoutBlockHeight,
    );

    if (!compareTrees(tree, compareTree)) {
        log.warn("reverse swap validation: swap tree mismatch");
        return false;
    }

    return validateAddress(
        swap,
        tree,
        ourKeys,
        theirPublicKey,
        swap.lockupAddress,
        buffer,
    );
};

const validateSwap = async (
    swap: SwapResponse,
    getEtherSwap: ContractGetter,
    buffer: any,
) => {
    // Amounts
    if (swap.expectedAmount !== swap.sendAmount) {
        return false;
    }

    if (swap.asset === RBTC) {
        return await validateContract(getEtherSwap);
    }

    // SwapTree
    const invoiceData = decodeInvoice(swap.invoice);

    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = ECPair.fromPrivateKey(buffer.from(swap.privateKey, "hex"));
    const theirPublicKey = buffer.from(swap.claimPublicKey, "hex");

    const compareTree = swapTree(
        swap.asset === "L-BTC",
        buffer.from(invoiceData.preimageHash, "hex"),
        theirPublicKey,
        ourKeys.publicKey,
        swap.timeoutBlockHeight,
    );

    if (!compareTrees(tree, compareTree)) {
        return false;
    }

    // Address
    if (
        !(await validateAddress(
            swap,
            tree,
            ourKeys,
            theirPublicKey,
            swap.address,
            buffer,
        ))
    ) {
        return false;
    }

    // BIP-21
    const bip21Split = swap.bip21.split("?");
    if (bip21Split[0].split(":")[1] !== swap.address) {
        return false;
    }

    return (
        new URLSearchParams(bip21Split[1]).get("amount") ===
        formatAmountDenomination(BigNumber(swap.sendAmount), denominations.btc)
    );
};

// To be able to use the Buffer from Node.js
export const validateResponse = async (
    swap: SwapResponse,
    getEtherSwap: ContractGetter,
    buffer: any = BufferBrowser,
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

export const validateInvoice = (inputValue: string) => {
    const isInputInvoice = isInvoice(inputValue);
    if (isLnurl(inputValue) || isInputInvoice) {
        // set receive/send when invoice differs from the amounts
        if (isInputInvoice) {
            const decoded = decodeInvoice(inputValue);
            if (decoded.satoshis === null || decoded.satoshis === 0) {
                throw new Error("invalid_0_amount");
            }
            return decoded.satoshis;
        }
    }
    throw new Error("invalid_invoice");
};
