import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { equalBytes } from "@scure/btc-signer/utils.js";
import { BigNumber } from "bignumber.js";
import type { Types } from "boltz-core";
import {
    Scripts,
    SwapTreeSerializer,
    compareTrees,
    reverseSwapTree,
    swapTree,
} from "boltz-core";
import type { BaseContract } from "ethers";
import { ethers } from "ethers";

import { LBTC, RBTC } from "../consts/Assets";
import { Denomination, Side, SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import { etherSwapCodeHashes } from "../context/Web3";
import type { ChainSwapDetails } from "./boltzClient";
import { decodeAddress } from "./compat";
import { formatAmountDenomination } from "./denomination";
import type { ECKeys } from "./ecpair";
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

const invalidSendAmountMsg = (expected: number, got: number) =>
    `invalid send amount. Expected ${expected}, got ${got}`;
const invalidReceiveAmountMsg = (expected: number, got: number) =>
    `invalid receive amount. Expected ${expected} to be bigger than ${got}`;

type ContractGetter = () => BaseContract;

const validateContract = async (
    getEtherSwap: ContractGetter,
): Promise<void> => {
    const codeHashes = etherSwapCodeHashes();
    if (codeHashes === undefined) {
        return;
    }

    const code = await getEtherSwap().getDeployedCode();
    if (!codeHashes.includes(ethers.keccak256(code))) {
        throw new Error(`invalid contract code: ${code}`);
    }
};

const validateAddress = (
    chain: string,
    tree: Types.SwapTree,
    ourKeys: ECKeys,
    theirPublicKey: Uint8Array,
    address: string,
    blindingKey: string | undefined,
): void => {
    const keyAgg = createMusig(ourKeys, theirPublicKey);
    const tweaked = tweakMusig(chain, keyAgg, tree.tree);

    const compareScript = Scripts.p2trOutput(tweaked.aggPubkey);
    const decodedAddress = decodeAddress(chain, address);

    if (!equalBytes(decodedAddress.script, compareScript)) {
        throw new Error("decoded address script mismatch");
    }

    if (chain === LBTC) {
        if (!blindingKey) {
            throw new Error("missing blindingKey for LBTC address validation");
        }
        const blindingPrivateKey = hex.decode(blindingKey);
        const blindingPublicKey = secp256k1.getPublicKey(blindingPrivateKey);

        if (
            !equalBytes(
                new Uint8Array(decodedAddress.blindingKey),
                blindingPublicKey,
            )
        ) {
            throw new Error("blinding public key mismatch");
        }
    }
};

const validateBip21 = (
    bip21: string,
    address: string,
    expectedAmount: number,
): void => {
    const bip21Split = bip21.split("?");
    if (bip21Split[0].split(":")[1] !== address) {
        throw new Error("invalid BIP21 format");
    }

    const params = new URLSearchParams(bip21Split[1]);

    if (expectedAmount === 0) {
        const hasAmount = params.has("amount");
        if (hasAmount) {
            throw new Error(
                `unexpected amount in BIP21. Expected 0, got ${params.get("amount")}`,
            );
        }
        return;
    }

    if (
        params.get("amount") !==
        formatAmountDenomination(
            BigNumber(expectedAmount),
            Denomination.Btc,
            ".",
        )
    ) {
        throw new Error(
            `invalid BIP21 amount. Expected ${expectedAmount}, got ${params.get("amount")}`,
        );
    }
};

const validateReverse = async (
    swap: ReverseSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
): Promise<void> => {
    const invoiceData = await decodeInvoice(swap.invoice);

    // Amounts
    if (invoiceData.satoshis !== swap.sendAmount) {
        throw new Error(
            invalidSendAmountMsg(invoiceData.satoshis, swap.sendAmount),
        );
    }

    if (swap.onchainAmount <= swap.receiveAmount) {
        throw new Error(
            invalidReceiveAmountMsg(swap.onchainAmount, swap.receiveAmount),
        );
    }

    // Invoice
    const preimageHash = sha256(hex.decode(swap.preimage));
    if (invoiceData.preimageHash !== hex.encode(preimageHash)) {
        throw new Error(
            `invalid swap preimage hash. Expected ${hex.encode(preimageHash)}, got ${invoiceData.preimageHash}`,
        );
    }

    if (swap.assetReceive === RBTC) {
        await validateContract(getEtherSwap);
        return;
    }

    // SwapTree
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = deriveKey(swap.claimPrivateKeyIndex);
    const theirPublicKey = hex.decode(swap.refundPublicKey);

    const compareTree = reverseSwapTree(
        swap.assetReceive === LBTC,
        preimageHash,
        new Uint8Array(ourKeys.publicKey),
        theirPublicKey,
        swap.timeoutBlockHeight,
    );

    if (!compareTrees(tree, compareTree)) {
        throw new Error("swap tree mismatch");
    }

    validateAddress(
        swap.assetReceive,
        tree,
        ourKeys,
        theirPublicKey,
        swap.lockupAddress,
        swap.blindingKey,
    );
};

const validateSubmarine = async (
    swap: SubmarineSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
): Promise<void> => {
    // Amounts
    if (swap.expectedAmount !== swap.sendAmount) {
        throw new Error(
            invalidSendAmountMsg(swap.expectedAmount, swap.sendAmount),
        );
    }

    if (swap.assetSend === RBTC) {
        await validateContract(getEtherSwap);
        return;
    }

    // SwapTree
    const invoiceData = await decodeInvoice(swap.invoice);

    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = deriveKey(swap.refundPrivateKeyIndex);
    const theirPublicKey = hex.decode(swap.claimPublicKey);

    const compareTree = swapTree(
        swap.assetSend === LBTC,
        hex.decode(invoiceData.preimageHash),
        theirPublicKey,
        new Uint8Array(ourKeys.publicKey),
        swap.timeoutBlockHeight,
    );

    if (!compareTrees(tree, compareTree)) {
        throw new Error("swap tree mismatch");
    }

    // Address
    validateAddress(
        swap.assetSend,
        tree,
        ourKeys,
        theirPublicKey,
        swap.address,
        swap.blindingKey,
    );

    validateBip21(swap.bip21, swap.address, swap.expectedAmount);
};

const validateChainSwap = async (
    swap: ChainSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
): Promise<void> => {
    const preimageHash = sha256(hex.decode(swap.preimage));

    const validateSide = async (
        side: Side,
        asset: string,
        details: ChainSwapDetails,
    ): Promise<void> => {
        if (side === Side.Send) {
            if (swap.sendAmount > 0 && details.amount !== swap.sendAmount) {
                throw new Error(
                    invalidSendAmountMsg(swap.sendAmount, details.amount),
                );
            }
        } else {
            if (
                swap.receiveAmount > 0 &&
                details.amount <= swap.receiveAmount
            ) {
                throw new Error(
                    invalidReceiveAmountMsg(swap.receiveAmount, details.amount),
                );
            }
        }

        if (asset === RBTC) {
            await validateContract(getEtherSwap);
            return;
        }

        const ourKeys = deriveKey(
            side === Side.Send
                ? swap.refundPrivateKeyIndex
                : swap.claimPrivateKeyIndex,
        );
        const theirPublicKey = hex.decode(details.serverPublicKey);
        const tree = SwapTreeSerializer.deserializeSwapTree(details.swapTree);
        const compareTree = reverseSwapTree(
            asset === LBTC,
            preimageHash,
            side === Side.Send
                ? theirPublicKey
                : new Uint8Array(ourKeys.publicKey),
            side === Side.Send
                ? new Uint8Array(ourKeys.publicKey)
                : theirPublicKey,
            details.timeoutBlockHeight,
        );

        if (!compareTrees(tree, compareTree)) {
            throw new Error("swap tree mismatch");
        }

        validateAddress(
            asset,
            tree,
            ourKeys,
            theirPublicKey,
            details.lockupAddress,
            details.blindingKey,
        );

        if (side === Side.Send) {
            validateBip21(details.bip21, details.lockupAddress, details.amount);
        }
    };

    await Promise.all([
        validateSide(Side.Send, swap.assetSend, swap.lockupDetails),
        validateSide(Side.Receive, swap.assetReceive, swap.claimDetails),
    ]);
};

export const validateResponse = async (
    swap: SomeSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
): Promise<void> => {
    switch (swap.type) {
        case SwapType.Submarine:
            await validateSubmarine(
                swap as SubmarineSwap,
                deriveKey,
                getEtherSwap,
            );
            break;

        case SwapType.Reverse:
            await validateReverse(swap as ReverseSwap, deriveKey, getEtherSwap);
            break;

        case SwapType.Chain:
            await validateChainSwap(swap as ChainSwap, deriveKey, getEtherSwap);
            break;

        default:
            throw new Error("unknown_swap_type");
    }
};

export const validateInvoice = async (inputValue: string) => {
    const isInputInvoice = isInvoice(inputValue);
    if (isLnurl(inputValue) || isInputInvoice) {
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
