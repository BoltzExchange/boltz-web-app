import { ClaimDetails, detectSwap } from "boltz-core";
import { LiquidClaimDetails } from "boltz-core/dist/lib/liquid";
import log from "loglevel";

import { RBTC } from "../consts";
import {
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setup,
} from "./compat";
import { ECPair } from "./ecpair";
import { fetcher, parseBlindingKey } from "./helper";

const createAdjustedClaim = <
    T extends
        | (ClaimDetails & { blindingPrivateKey?: Buffer })
        | LiquidClaimDetails,
>(
    swap: any,
    claimDetails: T[],
    destination: Buffer,
    assetHash?: string,
    blindingKey?: Buffer,
) => {
    const inputSum = claimDetails.reduce(
        (total: number, input: T) => total + getOutputAmount(swap.asset, input),
        0,
    );
    const feeBudget = Math.floor(inputSum - swap.receiveAmount);

    const constructClaimTransaction = getConstructClaimTransaction(swap.asset);
    return constructClaimTransaction(
        claimDetails as ClaimDetails[] | LiquidClaimDetails[],
        destination,
        feeBudget,
        true,
        assetHash,
        blindingKey,
    );
};

export const claim = async (
    swap: any,
    swapStatusTransaction: { hex: string },
    callback: (swap: any) => any,
) => {
    if (swap.asset === RBTC) {
        return;
    }

    await setup();
    const assetName = swap.asset;

    log.info("claiming swap: ", swap.id);
    if (!swapStatusTransaction) {
        return log.debug("no swapStatusTransaction tx found");
    }
    if (!swapStatusTransaction.hex) {
        return log.debug("swapStatusTransaction tx hex not found");
    }
    log.debug("swapStatusTransaction", swapStatusTransaction.hex);

    const Transaction = getTransaction(assetName);
    const net = getNetwork(assetName);
    const assetHash = assetName === "L-BTC" ? net.assetHash : undefined;

    let tx = Transaction.fromHex(swapStatusTransaction.hex);
    let redeemScript = Buffer.from(swap.redeemScript, "hex");

    let swapOutput = detectSwap(redeemScript, tx);
    let private_key = ECPair.fromPrivateKey(
        Buffer.from(swap.privateKey, "hex"),
    );
    log.debug("private_key: ", private_key);
    let preimage = Buffer.from(swap.preimage, "hex");
    log.debug("preimage: ", preimage);
    const { script, blindingKey } = decodeAddress(
        assetName,
        swap.onchainAddress,
    );
    const claimTransaction = createAdjustedClaim(
        swap,
        [
            {
                ...swapOutput,
                redeemScript,
                txHash: tx.getHash(),
                preimage: preimage,
                keys: private_key,
                blindingPrivateKey: parseBlindingKey(swap),
            },
        ],
        script,
        assetHash,
        blindingKey,
    ).toHex();
    log.debug("claim_tx", claimTransaction);
    fetcher(
        "/broadcasttransaction",
        assetName,
        (data: any) => {
            log.debug("claim result:", data);
            if (data.transactionId) {
                swap.claimTx = data.transactionId;
                callback(swap);
            }
        },
        {
            currency: assetName,
            transactionHex: claimTransaction,
        },
    );
};
