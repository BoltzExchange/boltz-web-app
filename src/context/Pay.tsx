import { OutputType } from "boltz-core";
import log from "loglevel";
import {
    createContext,
    createEffect,
    createSignal,
    on,
    useContext,
} from "solid-js";
import type { Accessor, JSX, Setter } from "solid-js";
import { hiddenInformation } from "src/components/settings/PrivacyMode";
import { BTC, LBTC } from "src/consts/Assets";
import { SwapType } from "src/consts/Enums";
import { swapStatusPending, swapStatusSuccess } from "src/consts/SwapStatus";
import { getTransactionOutSpend } from "src/utils/blockchain";
import {
    claim,
    createSubmarineSignature,
    createTheirPartialChainSwapSignature,
    findSwapOutputVout,
} from "src/utils/claim";
import { getTransaction } from "src/utils/compat";
import { getPair } from "src/utils/helper";

import {
    type LockupTransaction,
    getChainSwapTransactions,
    getReverseTransaction,
    postChainSwapDetails,
} from "../utils/boltzClient";
import { formatError } from "../utils/errors";
import { isSwapClaimable } from "../utils/rescue";
import {
    type ChainSwap,
    type ReverseSwap,
    type SomeSwap,
    type SubmarineSwap,
    isEvmSwap,
} from "../utils/swapCreator";
import { useGlobalContext } from "./Global";

type SwapStatus = {
    id: string;
    status: string;

    failureReason?: string;
    transaction?: SwapStatusTransaction;
};

export type PayContextType = {
    failureReason: Accessor<string>;
    setFailureReason: Setter<string>;
    swap: Accessor<SomeSwap | null>;
    setSwap: Setter<SomeSwap | null>;
    swapStatus: Accessor<string>;
    setSwapStatus: Setter<string>;
    swapStatusTransaction: Accessor<SwapStatusTransaction>;
    setSwapStatusTransaction: Setter<SwapStatusTransaction>;
    refundableUTXOs: Accessor<
        (Partial<LockupTransaction> & Pick<LockupTransaction, "hex">)[]
    >;
    setRefundableUTXOs: Setter<
        (Partial<LockupTransaction> & Pick<LockupTransaction, "hex">)[]
    >;
    shouldIgnoreBackendStatus: Accessor<boolean>;
    setShouldIgnoreBackendStatus: Setter<boolean>;
    claimSwap: (swapId: string, data: SwapStatus) => Promise<void>;
};

const PayContext = createContext<PayContextType>();

type SwapStatusTransaction = {
    hex?: string;
    id?: string;
};

const coopClaimableSymbols = [BTC, LBTC];

const PayProvider = (props: { children: JSX.Element }) => {
    const {
        t,
        deriveKey,
        getSwap,
        privacyMode,
        notify,
        pairs,
        setSwapStorage,
        zeroConf,
        getSwaps,
    } = useGlobalContext();
    const [failureReason, setFailureReason] = createSignal<string>("");
    const [swap, setSwap] = createSignal<SomeSwap | null>(null, {
        // To allow updating properties of the swap object without replacing it completely
        equals: () => false,
    });
    const [swapStatus, setSwapStatus] = createSignal<string>("");
    const [swapStatusTransaction, setSwapStatusTransaction] =
        createSignal<SwapStatusTransaction>({});
    const [refundableUTXOs, setRefundableUTXOs] = createSignal<
        (Partial<LockupTransaction> & Pick<LockupTransaction, "hex">)[]
    >([]);
    const [shouldIgnoreBackendStatus, setShouldIgnoreBackendStatus] =
        createSignal<boolean>(false);

    const helpServerClaim = async (swap: ChainSwap) => {
        if (swap.claimTx === undefined) {
            log.warn(
                `Not helping server claim Chain Swap ${swap.id} because we have not claimed yet`,
            );
            return;
        }

        try {
            log.debug(
                `Helping server claim ${swap.assetSend} of Chain Swap ${swap.id}`,
            );
            const sig = await createTheirPartialChainSwapSignature(
                deriveKey,
                swap,
            );
            await postChainSwapDetails(swap.id, undefined, sig);
        } catch (e) {
            log.warn(
                `Helping server claim Chain Swap ${swap.id} failed: ${formatError(e)}`,
            );
        }
    };

    const pendingServerClaimHelp = new Set<string>();
    const helpingServerClaims = new Set<string>();
    const maybeHelpServerClaim = async (chainSwap: ChainSwap) => {
        if (!pendingServerClaimHelp.has(chainSwap.id)) {
            return;
        }

        if (helpingServerClaims.has(chainSwap.id)) {
            return;
        }

        if (chainSwap.claimTx === undefined) {
            log.debug(
                `Deferred server claim help for Chain Swap ${chainSwap.id} is still waiting for claimTx`,
            );
            return;
        }

        helpingServerClaims.add(chainSwap.id);
        try {
            log.info(
                `Retrying deferred server claim help for Chain Swap ${chainSwap.id}`,
            );
            await helpServerClaim(chainSwap);
        } finally {
            pendingServerClaimHelp.delete(chainSwap.id);
            helpingServerClaims.delete(chainSwap.id);
        }
    };

    const claimingSwaps = new Set<string>();
    const claimSwap = async (swapId: string, data: SwapStatus) => {
        if (claimingSwaps.has(swapId)) {
            return;
        }

        const currentSwap = await getSwap(swapId);
        if (currentSwap === null) {
            log.warn(`claimSwap: swap ${swapId} not found`);
            return;
        }

        if (
            currentSwap.type === SwapType.Chain &&
            data.status === swapStatusPending.TransactionClaimPending &&
            coopClaimableSymbols.includes((currentSwap as ChainSwap).assetSend)
        ) {
            const chainSwap = currentSwap as ChainSwap;
            pendingServerClaimHelp.add(chainSwap.id);

            if (chainSwap.claimTx === undefined) {
                log.info(
                    `Deferring server claim help for Chain Swap ${chainSwap.id} until claimTx is known`,
                );
                return;
            }

            await maybeHelpServerClaim(chainSwap);
            return;
        }

        if (isEvmSwap(currentSwap)) {
            if (
                data.status === swapStatusPending.TransactionMempool &&
                data.transaction !== undefined
            ) {
                currentSwap.lockupTx = data.transaction.id;
                await setSwapStorage(currentSwap);
            }

            return;
        }

        if (currentSwap.version !== OutputType.Taproot) {
            return;
        }

        if (
            (currentSwap.type === SwapType.Reverse &&
                zeroConf() &&
                data.status === swapStatusPending.TransactionMempool) || // necessary for the autoclaim when zeroConf is toggled with a pending swap
            data.status === swapStatusSuccess.InvoiceSettled
        ) {
            data.transaction = await getReverseTransaction(currentSwap.id);
        } else if (
            currentSwap.type === SwapType.Chain &&
            (data.status === swapStatusSuccess.TransactionClaimed ||
                (zeroConf() &&
                    data.status === swapStatusPending.TransactionServerMempool)) // necessary for the autoclaim when zeroConf is toggled with a pending swap
        ) {
            data.transaction = (
                await getChainSwapTransactions(currentSwap.id)
            ).serverLock.transaction;
        }

        if (
            currentSwap.claimTx === undefined &&
            data.transaction !== undefined &&
            isSwapClaimable({
                status: data.status,
                type: currentSwap.type,
                includeSuccess: true,
                zeroConf: zeroConf(),
            })
        ) {
            try {
                claimingSwaps.add(swapId);

                const res = await claim(
                    deriveKey,
                    currentSwap as ReverseSwap | ChainSwap,
                    data.transaction as { hex: string },
                    true,
                );
                const claimedSwap = await getSwap(res.id);
                claimedSwap.claimTx = res.claimTx;
                await setSwapStorage(claimedSwap);

                if (claimedSwap.id === swap()?.id) {
                    setSwap(claimedSwap);
                }
                notify(
                    "success",
                    t("swap_completed", {
                        id: privacyMode() ? hiddenInformation : res.id,
                    }),
                );
            } catch (e) {
                if (
                    typeof e === "string" &&
                    (e.includes("bad-txns-inputs-missingorspent") ||
                        e.includes("Transaction outputs already in utxo set") ||
                        e.includes("Inputs missing or spent"))
                ) {
                    const lockupTx = getTransaction(
                        currentSwap.assetReceive,
                    ).fromHex(data.transaction.hex);
                    const vout = findSwapOutputVout(
                        deriveKey,
                        currentSwap as ReverseSwap | ChainSwap,
                        lockupTx,
                    );

                    if (vout !== undefined) {
                        try {
                            log.debug(
                                `swap ${currentSwap.id}: checking for spent status of tx output ${data.transaction.id}:${vout}`,
                            );
                            const outspend = await getTransactionOutSpend(
                                currentSwap.assetReceive,
                                data.transaction.id,
                                vout,
                            );

                            if (outspend?.spent && outspend.txid) {
                                log.debug(
                                    `swap ${currentSwap.id}: lockup tx was already claimed, updating claimTx id to ${outspend.txid}`,
                                );
                                currentSwap.claimTx = outspend.txid;
                                await setSwapStorage(currentSwap);

                                if (currentSwap.id === swap()?.id) {
                                    setSwap(currentSwap);
                                }

                                return;
                            }
                            log.debug(
                                `got bad-txns-inputs-missingorspent when claiming swap ${currentSwap.id} but tx ${data.transaction.id} is not spent`,
                            );
                        } catch (e) {
                            log.error(
                                `could not check if lockup tx from swap ${currentSwap.id} is spent: ${formatError(e)}`,
                            );
                        }
                    }
                }

                const msg = t("claim_fail", {
                    id: privacyMode() ? hiddenInformation : currentSwap.id,
                });
                log.error(msg, e);
                notify("error", msg);
            } finally {
                claimingSwaps.delete(swapId);
            }
        } else if (
            currentSwap.type === SwapType.Submarine &&
            data.status === swapStatusPending.TransactionClaimPending &&
            currentSwap.receiveAmount >=
                getPair(
                    pairs(),
                    currentSwap.type,
                    currentSwap.assetSend,
                    currentSwap.assetReceive,
                ).limits.minimal
        ) {
            try {
                await createSubmarineSignature(
                    deriveKey,
                    currentSwap as SubmarineSwap,
                );
                notify(
                    "success",
                    t("swap_completed", {
                        id: privacyMode() ? hiddenInformation : currentSwap.id,
                    }),
                );
            } catch (e) {
                if (e === "swap not eligible for a cooperative claim") {
                    log.debug(
                        `Server did not want help claiming ${currentSwap.id}`,
                    );
                    return;
                }

                const msg =
                    "creating cooperative signature for submarine swap claim failed";
                log.warn(msg, e);
                notify("error", msg);
            }
        }
    };

    createEffect(
        on([zeroConf], async () => {
            if (!zeroConf()) {
                return;
            }

            // Attempt to claim eligible swaps when zeroConf changes to true
            const swaps = await getSwaps();
            for (const swap of swaps) {
                if (
                    isSwapClaimable({
                        status: swap.status,
                        type: swap.type,
                        zeroConf: zeroConf(),
                        swap,
                    })
                ) {
                    try {
                        await claimSwap(swap.id, {
                            id: swap.id,
                            status: swap.status,
                        });
                    } catch (e) {
                        log.warn(
                            `Error claiming swap ${swap.id}: ${formatError(e)}`,
                        );
                        continue;
                    }
                }
            }
        }),
    );

    createEffect(
        on([swap, swapStatus], ([currentSwap, currentStatus]) => {
            if (
                currentSwap === null ||
                currentSwap.type !== SwapType.Chain ||
                currentStatus !== swapStatusPending.TransactionClaimPending
            ) {
                return;
            }

            void maybeHelpServerClaim(currentSwap as ChainSwap);
        }),
    );

    return (
        <PayContext.Provider
            value={{
                failureReason,
                setFailureReason,
                swap,
                setSwap,
                swapStatus,
                setSwapStatus,
                swapStatusTransaction,
                setSwapStatusTransaction,
                refundableUTXOs,
                setRefundableUTXOs,
                shouldIgnoreBackendStatus,
                setShouldIgnoreBackendStatus,
                claimSwap,
            }}>
            {props.children}
        </PayContext.Provider>
    );
};

const usePayContext = () => {
    const context = useContext(PayContext);
    if (!context) {
        throw new Error("usePayContext: cannot find a PayContext");
    }
    return context;
};

export { usePayContext, PayProvider, SwapStatusTransaction };
