import { BigNumber } from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import type { Types } from "boltz-core";
import {
    Scripts,
    SwapTreeSerializer,
    compareTrees,
    reverseSwapTree,
    swapTree,
} from "boltz-core";
import { default as BufferBrowser } from "buffer";
import type { ECPairInterface } from "ecpair";
import type { BaseContract } from "ethers";
import { ethers } from "ethers";
import log from "loglevel";

import { LBTC, RBTC } from "../consts/Assets";
import { Denomination, Side, SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import { etherSwapCodeHashes } from "../context/Web3";
import type { ChainSwapDetails } from "./boltzClient";
import { decodeAddress } from "./compat";
import { formatAmountDenomination } from "./denomination";
import { ecc } from "./ecpair";
import { decodeInvoice, isInvoice, isLnurl } from "./invoice";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "./swapCreator";
import { createMusig, tweakMusig } from "./taproot/musig";

// TODO: sanity check timeout block height?
// TODO: buffers for amounts

type ContractGetter = () => BaseContract;

const validateContract = async (getEtherSwap: ContractGetter) => {
    const codeHashes = etherSwapCodeHashes();
    if (codeHashes === undefined) {
        return true;
    }

    const code = await getEtherSwap().getDeployedCode();
    return codeHashes.includes(ethers.keccak256(code));
};

const validateAddress = async (
    chain: string,
    tree: Types.SwapTree,
    ourKeys: ECPairInterface,
    theirPublicKey: Buffer,
    address: string,
    blindingKey: string | undefined,
    buffer: BufferConstructor,
) => {
    const tweakedKey = tweakMusig(
        chain,
        await createMusig(ourKeys, theirPublicKey),
        tree.tree,
    );

    const compareScript = Scripts.p2trOutput(tweakedKey);
    const decodedAddress = decodeAddress(chain, address);

    if (!decodedAddress.script.equals(compareScript)) {
        return false;
    }

    if (chain === "L-BTC") {
        const blindingPrivateKey = buffer.from(blindingKey, "hex");
        const blindingPublicKey = buffer.from(
            ecc.pointFromScalar(blindingPrivateKey),
        );

        if (!blindingPublicKey.equals(decodedAddress.blindingKey)) {
            return false;
        }
    }

    return true;
};

const validateBip21 = (
    bip21: string,
    address: string,
    expectedAmount: number,
) => {
    const bip21Split = bip21.split("?");
    if (bip21Split[0].split(":")[1] !== address) {
        return false;
    }

    const params = new URLSearchParams(bip21Split[1]);

    if (expectedAmount === 0) {
        return !params.has("amount");
    }

    return (
        params.get("amount") ===
        formatAmountDenomination(
            BigNumber(expectedAmount),
            Denomination.Btc,
            ".",
        )
    );
};

const validateReverse = async (
    swap: ReverseSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
    buffer: BufferConstructor,
) => {
    const invoiceData = await decodeInvoice(swap.invoice);

    // Amounts
    if (
        invoiceData.satoshis !== swap.sendAmount ||
        swap.onchainAmount <= swap.receiveAmount
    ) {
        return false;
    }

    // Invoice
    const preimageHash = crypto.sha256(buffer.from(swap.preimage, "hex"));
    if (invoiceData.preimageHash !== preimageHash.toString("hex")) {
        return false;
    }

    if (swap.assetReceive === RBTC) {
        return validateContract(getEtherSwap);
    }

    // SwapTree
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = deriveKey(swap.claimPrivateKeyIndex);
    const theirPublicKey = buffer.from(swap.refundPublicKey, "hex");

    const compareTree = reverseSwapTree(
        swap.assetReceive === "L-BTC",
        preimageHash,
        Buffer.from(ourKeys.publicKey),
        theirPublicKey,
        swap.timeoutBlockHeight,
    );

    if (!compareTrees(tree, compareTree)) {
        return false;
    }

    return validateAddress(
        swap.assetReceive,
        tree,
        ourKeys,
        theirPublicKey,
        swap.lockupAddress,
        swap.blindingKey,
        buffer,
    );
};

const validateSubmarine = async (
    swap: SubmarineSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
    buffer: typeof BufferBrowser.Buffer,
) => {
    // Amounts
    if (swap.expectedAmount !== swap.sendAmount) {
        return false;
    }

    if (swap.assetSend === RBTC) {
        return validateContract(getEtherSwap);
    }

    // SwapTree
    const invoiceData = await decodeInvoice(swap.invoice);

    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = deriveKey(swap.refundPrivateKeyIndex);
    const theirPublicKey = buffer.from(swap.claimPublicKey, "hex");

    const compareTree = swapTree(
        swap.assetSend === "L-BTC",
        buffer.from(invoiceData.preimageHash, "hex"),
        theirPublicKey,
        Buffer.from(ourKeys.publicKey),
        swap.timeoutBlockHeight,
    );

    if (!compareTrees(tree, compareTree)) {
        return false;
    }

    // Address
    if (
        !(await validateAddress(
            swap.assetSend,
            tree,
            ourKeys,
            theirPublicKey,
            swap.address,
            swap.blindingKey,
            buffer,
        ))
    ) {
        return false;
    }

    return validateBip21(swap.bip21, swap.address, swap.expectedAmount);
};

const validateChainSwap = async (
    swap: ChainSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
    buffer: BufferConstructor,
) => {
    const preimageHash = crypto.sha256(buffer.from(swap.preimage, "hex"));

    const validateSide = async (
        side: Side,
        asset: string,
        details: ChainSwapDetails,
    ) => {
        if (side === Side.Send) {
            if (swap.sendAmount > 0 && details.amount !== swap.sendAmount) {
                return false;
            }
        } else {
            if (
                swap.receiveAmount > 0 &&
                details.amount <= swap.receiveAmount
            ) {
                return false;
            }
        }

        if (asset === RBTC) {
            return validateContract(getEtherSwap);
        }

        const ourKeys = deriveKey(
            side === Side.Send
                ? swap.refundPrivateKeyIndex
                : swap.claimPrivateKeyIndex,
        );
        const theirPublicKey = buffer.from(details.serverPublicKey, "hex");
        const tree = SwapTreeSerializer.deserializeSwapTree(details.swapTree);
        const compareTree = reverseSwapTree(
            asset === LBTC,
            preimageHash,
            side === Side.Send
                ? theirPublicKey
                : Buffer.from(ourKeys.publicKey),
            side === Side.Send
                ? Buffer.from(ourKeys.publicKey)
                : theirPublicKey,
            details.timeoutBlockHeight,
        );

        if (!compareTrees(tree, compareTree)) {
            return false;
        }

        if (
            !(await validateAddress(
                asset,
                tree,
                ourKeys,
                theirPublicKey,
                details.lockupAddress,
                details.blindingKey,
                buffer,
            ))
        ) {
            return false;
        }

        return (
            side === Side.Receive ||
            validateBip21(details.bip21, details.lockupAddress, details.amount)
        );
    };

    return (
        await Promise.all([
            validateSide(Side.Send, swap.assetSend, swap.lockupDetails),
            validateSide(Side.Receive, swap.assetReceive, swap.claimDetails),
        ])
    ).every((ok) => ok);
};

// To be able to use the Buffer from Node.js
export const validateResponse = async (
    swap: SomeSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
    buffer: typeof BufferBrowser.Buffer = BufferBrowser as never,
): Promise<boolean> => {
    try {
        switch (swap.type) {
            case SwapType.Submarine:
                return await validateSubmarine(
                    swap as SubmarineSwap,
                    deriveKey,
                    getEtherSwap,
                    buffer,
                );

            case SwapType.Reverse:
                return await validateReverse(
                    swap as ReverseSwap,
                    deriveKey,
                    getEtherSwap,
                    buffer,
                );

            case SwapType.Chain:
                return await validateChainSwap(
                    swap as ChainSwap,
                    deriveKey,
                    getEtherSwap,
                    buffer,
                );
            default:
                throw new Error("unknown_swap_type");
        }
    } catch (e) {
        log.warn(`${swap.type} swap validation threw`, e);
        return false;
    }
};

export const validateInvoice = async (inputValue: string) => {
    const isInputInvoice = isInvoice(inputValue);
    if (isLnurl(inputValue) || isInputInvoice) {
        // set receive/send when the invoice differs from the amounts
        if (isInputInvoice) {
            const decoded = await decodeInvoice(inputValue);
            if (decoded.satoshis === 0) {
                throw new Error("invalid_0_amount");
            }
            return decoded.satoshis;
        }
    }
    throw new Error("invalid_invoice");
};
