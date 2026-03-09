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

import {
    AssetKind,
    type AssetType,
    BTC,
    LBTC,
    getKindForAsset,
    isEvmAsset,
} from "../consts/Assets";
import { Denomination, Side, SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import { erc20SwapCodeHashes, etherSwapCodeHashes } from "../context/Web3";
import type { ChainSwapDetails } from "./boltzClient";
import { decodeAddress } from "./compat";
import { formatAmountDenomination } from "./denomination";
import type { ECKeys } from "./ecpair";
import { decodeInvoice, isInvoice, isLnurl } from "./invoice";
import { HopsPosition } from "./Pair";
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

type ContractGetter = (asset: string) => BaseContract;

const validateContract = async (
    getEtherSwap: ContractGetter,
    getErc20Swap: ContractGetter,
    asset: string,
): Promise<void> => {
    const isEtherSwap = getKindForAsset(asset) === AssetKind.EVMNative;

    const codeHashes = isEtherSwap
        ? etherSwapCodeHashes()
        : erc20SwapCodeHashes();
    if (codeHashes === undefined) {
        return;
    }

    const code = await (
        isEtherSwap ? getEtherSwap(asset) : getErc20Swap(asset)
    ).getDeployedCode();
    const hash = ethers.keccak256(code);

    if (!codeHashes.includes(hash)) {
        throw new Error(`invalid contract code hash: ${hash}`);
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

        if (!equalBytes(decodedAddress.blindingKey, blindingPublicKey)) {
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
            BTC,
        )
    ) {
        throw new Error(
            `invalid BIP21 amount. Expected ${expectedAmount}, got ${params.get("amount")}`,
        );
    }
};

const validateErc20Amount = (
    expectedAmount: number,
    gotAmount: number,
    slippage: number,
    side: Side,
) => {
    const tolerance = Math.ceil(expectedAmount * slippage);
    const isInvalid =
        side === Side.Send
            ? Math.abs(expectedAmount - gotAmount) > tolerance
            : gotAmount < expectedAmount - tolerance;

    if (isInvalid) {
        throw new Error(
            side === Side.Send
                ? invalidSendAmountMsg(expectedAmount, gotAmount)
                : invalidReceiveAmountMsg(expectedAmount, gotAmount),
        );
    }
};

const validateReverse = async (
    swap: ReverseSwap,
    deriveKey: deriveKeyFn,
    getEtherSwap: ContractGetter,
    getErc20Swap: ContractGetter,
    slippage: number,
    hopsPosition?: HopsPosition,
): Promise<void> => {
    const invoiceData = await decodeInvoice(swap.invoice);

    // Amounts
    if (hopsPosition === HopsPosition.After) {
        validateErc20Amount(
            invoiceData.satoshis,
            swap.sendAmount,
            slippage,
            Side.Send,
        );
    } else {
        if (invoiceData.satoshis !== swap.sendAmount) {
            throw new Error(
                invalidSendAmountMsg(invoiceData.satoshis, swap.sendAmount),
            );
        }
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

    if (isEvmAsset(swap.assetReceive)) {
        await validateContract(getEtherSwap, getErc20Swap, swap.assetReceive);
        return;
    }

    // SwapTree
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = deriveKey(
        swap.claimPrivateKeyIndex,
        swap.assetReceive as AssetType,
    );
    const theirPublicKey = hex.decode(swap.refundPublicKey);

    const compareTree = reverseSwapTree(
        swap.assetReceive === LBTC,
        preimageHash,
        ourKeys.publicKey,
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
    getErc20Swap: ContractGetter,
    slippage: number,
    hopsPosition?: HopsPosition,
): Promise<void> => {
    // Amounts
    if (hopsPosition === HopsPosition.Before) {
        validateErc20Amount(
            swap.expectedAmount,
            swap.sendAmount,
            slippage,
            Side.Send,
        );
    } else {
        if (swap.expectedAmount !== swap.sendAmount) {
            throw new Error(
                invalidSendAmountMsg(swap.expectedAmount, swap.sendAmount),
            );
        }
    }

    if (isEvmAsset(swap.assetSend)) {
        await validateContract(getEtherSwap, getErc20Swap, swap.assetSend);
        return;
    }

    // SwapTree
    const invoiceData = await decodeInvoice(swap.invoice);

    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = deriveKey(
        swap.refundPrivateKeyIndex,
        swap.assetSend as AssetType,
    );
    const theirPublicKey = hex.decode(swap.claimPublicKey);

    const compareTree = swapTree(
        swap.assetSend === LBTC,
        hex.decode(invoiceData.preimageHash),
        theirPublicKey,
        ourKeys.publicKey,
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
    getErc20Swap: ContractGetter,
    slippage: number,
    hopsPosition?: HopsPosition,
): Promise<void> => {
    const preimageHash = sha256(hex.decode(swap.preimage));

    const validateSide = async (
        side: Side,
        asset: string,
        details: ChainSwapDetails,
    ): Promise<void> => {
        if (side === Side.Send) {
            if (hopsPosition === HopsPosition.Before) {
                if (swap.sendAmount > 0) {
                    validateErc20Amount(
                        swap.sendAmount,
                        details.amount,
                        slippage,
                        side,
                    );
                }
            } else {
                if (swap.sendAmount > 0 && details.amount !== swap.sendAmount) {
                    throw new Error(
                        invalidSendAmountMsg(swap.sendAmount, details.amount),
                    );
                }
            }
        } else {
            if (hopsPosition === HopsPosition.After) {
                if (swap.receiveAmount > 0) {
                    validateErc20Amount(
                        swap.receiveAmount,
                        details.amount,
                        slippage,
                        side,
                    );
                }
            } else {
                if (
                    swap.receiveAmount > 0 &&
                    details.amount <= swap.receiveAmount
                ) {
                    throw new Error(
                        invalidReceiveAmountMsg(
                            swap.receiveAmount,
                            details.amount,
                        ),
                    );
                }
            }
        }

        if (isEvmAsset(asset)) {
            await validateContract(getEtherSwap, getErc20Swap, asset);
            return;
        }

        const ourKeys = deriveKey(
            side === Side.Send
                ? swap.refundPrivateKeyIndex
                : swap.claimPrivateKeyIndex,
            asset as AssetType,
        );
        const theirPublicKey = hex.decode(details.serverPublicKey);
        const tree = SwapTreeSerializer.deserializeSwapTree(details.swapTree);
        const compareTree = reverseSwapTree(
            asset === LBTC,
            preimageHash,
            side === Side.Send ? theirPublicKey : ourKeys.publicKey,
            side === Side.Send ? ourKeys.publicKey : theirPublicKey,
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
    getErc20Swap: ContractGetter,
    slippage: number,
    hopsPosition?: HopsPosition,
): Promise<void> => {
    switch (swap.type) {
        case SwapType.Submarine:
            await validateSubmarine(
                swap as SubmarineSwap,
                deriveKey,
                getEtherSwap,
                getErc20Swap,
                slippage,
                hopsPosition,
            );
            break;

        case SwapType.Reverse:
            await validateReverse(
                swap as ReverseSwap,
                deriveKey,
                getEtherSwap,
                getErc20Swap,
                slippage,
                hopsPosition,
            );
            break;

        case SwapType.Chain:
            await validateChainSwap(
                swap as ChainSwap,
                deriveKey,
                getEtherSwap,
                getErc20Swap,
                slippage,
                hopsPosition,
            );
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
