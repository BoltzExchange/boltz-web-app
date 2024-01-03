import { detectSwap } from "boltz-core";
import { Buffer } from "buffer";
import log from "loglevel";

import {
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setup,
} from "../compat";
import { RBTC } from "../consts";
import { ECPair } from "../ecpair/ecpair";
import { fetcher, getApiUrl, parseBlindingKey } from "../helper";
import { setSwaps, swaps } from "../signals";

type SwapStatusReverse = {
    hex: string;
    eta: number;
    id: string;
};

const createAdjustedClaim = (
    swap: any,
    claimDetails: any,
    destination: any,
    assetHash: any,
    blindingKey: any,
) => {
    const inputSum = claimDetails.reduce(
        (total: number, input: any) =>
            total + getOutputAmount(swap.asset, input),
        0,
    );
    const feeBudget = Math.floor(inputSum - swap.receiveAmount);
    const constructClaimTransaction = getConstructClaimTransaction(swap.asset);
    return constructClaimTransaction(
        claimDetails,
        destination,
        feeBudget,
        true,
        // @ts-ignore
        assetHash,
        blindingKey,
    );
};

export const claim = async (swap: any, swapStatus: SwapStatusReverse) => {
    if (swap.asset === RBTC) {
        return;
    }

    await setup();
    const asset_name = swap.asset;

    log.info("claiming swap: ", swap.id);

    if (!swapStatus.hex) {
        return log.debug("mempool tx hex not found");
    }

    const Transaction = getTransaction(asset_name);
    const net = getNetwork(asset_name);
    const assetHash = asset_name === "L-BTC" ? net.assetHash : undefined;

    let tx = Transaction.fromHex(swapStatus.hex);
    let redeemScript = Buffer.from(swap.redeemScript, "hex");

    let swapOutput = detectSwap(redeemScript, tx);
    let private_key = ECPair.fromPrivateKey(
        Buffer.from(swap.privateKey, "hex"),
    );
    let preimage = Buffer.from(swap.preimage, "hex");
    const { script, blindingKey } = decodeAddress(
        asset_name,
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
    fetcher(
        getApiUrl("/broadcasttransaction", swap.asset),
        (data) => {
            log.debug("claim result:", data);
            if (data.transactionId) {
                const swapsTmp = swaps();
                const currentSwap = swapsTmp.find((s) => swap.id === s.id);
                currentSwap.claimTx = data.transactionId;
                setSwaps(swapsTmp);
            }
        },
        {
            currency: asset_name,
            transactionHex: claimTransaction,
        },
    );
};
