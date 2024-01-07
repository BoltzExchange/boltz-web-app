import {
    ClaimDetails,
    OutputType,
    RefundDetails,
    SwapTreeSerializer,
    detectSwap,
} from "boltz-core";
import {
    LiquidClaimDetails,
    LiquidRefundDetails,
} from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import { ECPairInterface } from "ecpair";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { LBTC, RBTC } from "../consts";
import {
    TransactionInterface,
    getPartialRefundSignature,
    getPartialReverseClaimSignature,
} from "./boltzClient";
import {
    DecodedAddress,
    decodeAddress,
    getAddress,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setup,
} from "./compat";
import { ECPair } from "./ecpair";
import { feeChecker } from "./feeChecker";
import { swapStatusPending, updateSwapStatus } from "./swapStatus";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";
import { pairs } from "../config";


export const isIos = !!navigator.userAgent.match(/iphone|ipad/gi) || false;
export const isMobile =
    isIos || !!navigator.userAgent.match(/android|blackberry/gi) || false;

export const parseBlindingKey = (swap: { blindingKey: string | undefined }) => {
    return swap.blindingKey ? Buffer.from(swap.blindingKey, "hex") : undefined;
};

export const cropString = (str: string) => {
    if (str.length < 40) {
        return str;
    }
    return str.substring(0, 19) + "..." + str.substring(str.length - 19);
};

export const clipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

export const getApiUrl = (asset: string) => {
    const pair = pairs[`${asset}/BTC`];
    if (pair) {
        return pair.apiUrl;
    }

    log.error(`no pair found for ${asset}; falling back to ${BTC}`);
    return getApiUrl(BTC);
};

export const fetcher = async (
    url: string,
    asset: string = BTC,
    params: any | undefined = null,
) => {
    let opts = {};
    if (params) {
        opts = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        };
    }
    const apiUrl = getApiUrl(asset) + url;
    const response = await fetch(apiUrl, opts);
    if (!response.ok) {
        return Promise.reject(response);
    return response.json();
};

export async function refund(swap: any, t: any) {
    log.debug("starting to refund swap", swap);
    setRefundTx("");

    const asset_name = swap.asset;

    let output: DecodedAddress;
    try {
        output = decodeAddress(asset_name, refundAddress());
    } catch (e) {
        log.error(e);
        setNotificationType("error");
        setNotification("invalid address");
        return false;
    }
    log.info("refunding swap: ", swap.id);
    let [_, fees] = await Promise.all([setup(), getfeeestimation(swap)]);

    let txToRefund = transactionToRefund();

    if (txToRefund === null) {
        txToRefund = await new Promise((resolve, reject) => {
            fetcher(
                "/getswaptransaction",
                (res: any) => {
                    log.debug(`got swap transaction for ${swap.id}`);
                    resolve(res);
                },
                {
                    id: swap.id,
                },
                () => {
                    log.warn(`no swap transaction for: ${swap.id}`);
                    reject();
                },
            );
        });
    }

    const Transaction = getTransaction(asset_name);

    const tx = Transaction.fromHex(txToRefund.transactionHex);
    const privateKey = ECPair.fromPrivateKey(
        Buffer.from(swap.privateKey, "hex"),
    );
    log.debug("privateKey", privateKey);

    let refundTransaction: TransactionInterface;

    if (swap.version === OutputType.Taproot) {
        refundTransaction = await refundTaproot(
            swap,
            tx,
            privateKey,
            output,
            fees,
        );
    } else {
        const redeemScript = Buffer.from(swap.redeemScript, "hex");
        log.debug("redeemScript", redeemScript);
        const swapOutput = detectSwap(redeemScript, tx);
        log.debug("swapOutput", swapOutput);

        const constructRefundTransaction =
            getConstructRefundTransaction(asset_name);
        refundTransaction = constructRefundTransaction(
            [
                {
                    ...swapOutput,
                    txHash: tx.getHash(),
                    redeemScript: redeemScript,
                    keys: privateKey,
                    blindingPrivateKey: parseBlindingKey(swap),
                } as RefundDetails & LiquidRefundDetails,
            ],
            output.script,
            txToRefund.timeoutBlockHeight,
            fees,
            true, // rbf
            asset_name === LBTC
                ? (getNetwork(asset_name) as LiquidNetwork)
                : undefined,
            output.blindingKey,
        );
    }

    log.debug("refundTransaction", refundTransaction.toHex());
    fetcher(
        "/broadcasttransaction",
        (data: any) => {
            log.debug("refund result:", data);
            if (data.transactionId) {
                // save refundTx into swaps json and set it to the current swap
                // only if the swaps was not initiated with the refund json
                // refundjson has no date
                if (swap.date !== undefined) {
                    const tmpSwaps = swaps();
                    const currentSwap = tmpSwaps.find((s) => s.id === swap.id);
                    currentSwap.refundTx = data.transactionId;
                    setSwaps(tmpSwaps);
                    setSwap(currentSwap);
                    log.debug("current_swap", currentSwap);
                    log.debug("swaps", tmpSwaps);
                } else {
                    setRefundTx(data.transactionId);
                }

                setNotificationType("success");
                setNotification(t("broadcasted"));
            }
        },
        {
            currency: asset_name,
            transactionHex: refundTransaction.toHex(),
        },
        (error) => {
            console.log(error);
            setNotificationType("error");
            if (typeof error.json === "function") {
                error
                    .json()
                    .then((jsonError: any) => {
                        let msg = jsonError.error;
                        if (
                            msg === "bad-txns-inputs-missingorspent" ||
                            msg === "Transaction already in block chain"
                        ) {
                            msg = t("already_refunded");
                        } else if (
                            msg === "mandatory-script-verify-flag-failed"
                        ) {
                            msg = t("locktime_not_satisfied");
                        }
                        setNotification(msg);
                    })
                    .catch((genericError: any) => {
                        log.debug("generic error", genericError);
                        log.error(genericError);
                        setNotification(error.statusText);
                    });
            } else {
                setNotification(error.message);
            }
        },
    );
    return true;
}

const createAdjustedClaim = <
    T extends
        | (ClaimDetails & { blindingPrivateKey?: Buffer })
        | LiquidClaimDetails,
>(
    swap: any,
    claimDetails: T[],
    destination: Buffer,
    liquidNetwork?: LiquidNetwork,
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
        liquidNetwork,
        blindingKey,
    );
};

export const claim = async (swap: any) => {
    if (swap.asset === RBTC) {
        return;
    }

    await setup();
    const asset_name = swap.asset;

    log.info("claiming swap: ", swap.id);
    let rawTx = swapStatusTransaction();
    if (!rawTx) {
        return log.debug("no mempool tx found");
    }
    if (!rawTx.hex) {
        return log.debug("mempool tx hex not found");
    }
    log.debug("rawTx", rawTx.hex);

    const Transaction = getTransaction(asset_name);

    const tx = Transaction.fromHex(rawTx.hex);

    const privateKey = ECPair.fromPrivateKey(
        Buffer.from(swap.privateKey, "hex"),
    );
    log.debug("privateKey: ", privateKey);
    const preimage = Buffer.from(swap.preimage, "hex");
    log.debug("preimage: ", preimage);
    const decodedAddress = decodeAddress(asset_name, swap.onchainAddress);

    let claimTransaction: TransactionInterface;

    if (swap.version === OutputType.Taproot) {
        claimTransaction = await claimTaproot(
            swap,
            tx,
            privateKey,
            preimage,
            decodedAddress,
        );
    } else {
        const redeemScript = Buffer.from(swap.redeemScript, "hex");
        const swapOutput = detectSwap(redeemScript, tx);

        claimTransaction = createAdjustedClaim(
            swap,
            [
                {
                    ...swapOutput,
                    redeemScript,
                    txHash: tx.getHash(),
                    preimage: preimage,
                    keys: privateKey,
                    blindingPrivateKey: parseBlindingKey(swap),
                },
            ],
            decodedAddress.script,
            asset_name === LBTC
                ? (getNetwork(asset_name) as LiquidNetwork)
                : undefined,
            decodedAddress.blindingKey,
        );
    }

    log.debug("claim_tx", claimTransaction.toHex());
    fetcher(
        "/broadcasttransaction",
        (data: any) => {
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
            transactionHex: claimTransaction.toHex(),
        },
    );
};

const claimTaproot = async (
    swap: any,
    lockupTx: TransactionInterface,
    privateKey: ECPairInterface,
    preimage: Buffer,
    decodedAddress: DecodedAddress,
) => {
    const boltzPublicKey = Buffer.from(swap.refundPublicKey, "hex");
    const musig = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweakedKey = tweakMusig(swap.asset, musig, tree.tree);

    const swapOutput = detectSwap(tweakedKey, lockupTx);

    const details = [
        {
            ...swapOutput,
            keys: privateKey,
            cooperative: true,
            preimage: preimage,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap),
        },
    ] as (ClaimDetails & { blindingPrivateKey: Buffer })[];
    const claimTx = createAdjustedClaim(
        swap,
        details,
        decodedAddress.script,
        swap.asset === LBTC
            ? (getNetwork(swap.asset) as LiquidNetwork)
            : undefined,
        decodedAddress.blindingKey,
    );

    const boltzSig = await getPartialReverseClaimSignature(
        swap.id,
        preimage,
        Buffer.from(musig.getPublicNonce()),
        claimTx,
        0,
    );
    musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
    musig.initializeSession(
        hashForWitnessV1(
            swap.asset,
            getNetwork(swap.asset),
            details,
            claimTx,
            0,
        ),
    );
    musig.signPartial();
    musig.addPartial(boltzPublicKey, boltzSig.signature);

    claimTx.ins[0].witness = [musig.aggregatePartials()];

    return claimTx;
};

const refundTaproot = async (
    swap: any,
    lockupTx: TransactionInterface,
    privateKey: ECPairInterface,
    decodedAddress: DecodedAddress,
    fees: number,
) => {
    const boltzPublicKey = Buffer.from(swap.claimPublicKey, "hex");
    const musig = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweakedKey = tweakMusig(swap.asset, musig, tree.tree);

    const swapOutput = detectSwap(tweakedKey, lockupTx);

    const details = [
        {
            ...swapOutput,
            keys: privateKey,
            cooperative: true,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap),
        } as RefundDetails & LiquidRefundDetails,
    ];

    const constructRefundTransaction = getConstructRefundTransaction(
        swap.asset,
    );
    const claimTx = constructRefundTransaction(
        details,
        decodedAddress.script,
        0,
        fees,
        true,
        getNetwork(swap.asset) as LiquidNetwork,
        decodedAddress.blindingKey,
    );

    const boltzSig = await getPartialRefundSignature(
        swap.id,
        Buffer.from(musig.getPublicNonce()),
        claimTx,
        0,
    );
    musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
    musig.initializeSession(
        hashForWitnessV1(
            swap.asset,
            getNetwork(swap.asset),
            details,
            claimTx,
            0,
        ),
    );
    musig.signPartial();
    musig.addPartial(boltzPublicKey, boltzSig.signature);

    claimTx.ins[0].witness = [musig.aggregatePartials()];

    return claimTx;
};
