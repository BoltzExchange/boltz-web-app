import { BigNumber } from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import {
    Scripts,
    SwapTreeSerializer,
    Types,
    compareTrees,
    reverseSwapTree,
    swapTree,
} from "boltz-core";
import { default as BufferBrowser } from "buffer";
import { ECPairInterface } from "ecpair";
import { BaseContract } from "ethers";
import log from "loglevel";

import { LBTC, RBTC } from "../consts/Assets";
import { Denomination, Side, SwapType } from "../consts/Enums";
import { ChainSwapDetails } from "./boltzClient";
import { decodeAddress, setup } from "./compat";
import { formatAmountDenomination } from "./denomination";
import { ECPair, ecc } from "./ecpair";
import { decodeInvoice, isInvoice, isLnurl } from "./invoice";
import { ChainSwap, ReverseSwap, SomeSwap, SubmarineSwap } from "./swapCreator";
import { createMusig, tweakMusig } from "./taproot/musig";

// TODO: sanity check timeout block height?
// TODO: buffers for amounts

type ContractGetter = () => Promise<BaseContract>;

const validateContract = async (getEtherSwap: ContractGetter) => {
    /*
    const code = await (await getEtherSwap()).getDeployedCode();
    const codeMatches = code === EtherSwapBytecode.object;
*/
    // TODO: actually verify the code match
    // This check is currently disabled, because it mismatches on RSK, because it was compiled for a different EVM target
    return true;
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
    await setup();
    const tweakedKey = tweakMusig(
        chain,
        createMusig(ourKeys, theirPublicKey),
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

    return (
        new URLSearchParams(bip21Split[1]).get("amount") ===
        formatAmountDenomination(
            BigNumber(expectedAmount),
            Denomination.Btc,
            ".",
        )
    );
};

const validateReverse = async (
    swap: ReverseSwap,
    getEtherSwap: ContractGetter,
    buffer: BufferConstructor,
) => {
    const invoiceData = decodeInvoice(swap.invoice);

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
        return await validateContract(getEtherSwap);
    }

    // SwapTree
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = ECPair.fromPrivateKey(
        buffer.from(swap.claimPrivateKey, "hex"),
    );
    const theirPublicKey = buffer.from(swap.refundPublicKey, "hex");

    const compareTree = reverseSwapTree(
        swap.assetReceive === "L-BTC",
        preimageHash,
        ourKeys.publicKey,
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
    getEtherSwap: ContractGetter,
    buffer: any,
) => {
    // Amounts
    if (swap.expectedAmount !== swap.sendAmount) {
        return false;
    }

    if (swap.assetSend === RBTC) {
        return await validateContract(getEtherSwap);
    }

    // SwapTree
    const invoiceData = decodeInvoice(swap.invoice);

    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);

    const ourKeys = ECPair.fromPrivateKey(
        buffer.from(swap.refundPrivateKey, "hex"),
    );
    const theirPublicKey = buffer.from(swap.claimPublicKey, "hex");

    const compareTree = swapTree(
        swap.assetSend === "L-BTC",
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
            if (details.amount !== swap.sendAmount) {
                return false;
            }
        } else {
            if (details.amount <= swap.receiveAmount) {
                return false;
            }
        }

        if (asset === RBTC) {
            return await validateContract(getEtherSwap);
        }

        const ourKeys = ECPair.fromPrivateKey(
            buffer.from(
                side === Side.Send
                    ? swap.refundPrivateKey
                    : swap.claimPrivateKey,
                "hex",
            ),
        );
        const theirPublicKey = buffer.from(details.serverPublicKey, "hex");
        const tree = SwapTreeSerializer.deserializeSwapTree(details.swapTree);
        const compareTree = reverseSwapTree(
            asset === LBTC,
            preimageHash,
            side === Side.Send ? theirPublicKey : ourKeys.publicKey,
            side === Side.Send ? ourKeys.publicKey : theirPublicKey,
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
    getEtherSwap: ContractGetter,
    buffer: any = BufferBrowser,
): Promise<boolean> => {
    try {
        switch (swap.type) {
            case SwapType.Submarine:
                return validateSubmarine(
                    swap as SubmarineSwap,
                    getEtherSwap,
                    buffer,
                );

            case SwapType.Reverse:
                return validateReverse(
                    swap as ReverseSwap,
                    getEtherSwap,
                    buffer,
                );

            case SwapType.Chain:
                return validateChainSwap(
                    swap as ChainSwap,
                    getEtherSwap,
                    buffer,
                );
        }
    } catch (e) {
        log.warn(`${swap.type} swap validation threw`, e);
        return false;
    }
};

export const validateInvoice = (inputValue: string) => {
    const isInputInvoice = isInvoice(inputValue);
    if (isLnurl(inputValue) || isInputInvoice) {
        // set receive/send when invoice differs from the amounts
        if (isInputInvoice) {
            const decoded = decodeInvoice(inputValue);
            if (decoded.satoshis === 0) {
                throw new Error("invalid_0_amount");
            }
            return decoded.satoshis;
        }
    }
    throw new Error("invalid_invoice");
};
