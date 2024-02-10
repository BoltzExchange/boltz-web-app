import { useParams } from "@solidjs/router";
import log from "loglevel";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import InvoiceExpired from "../status/InvoiceExpired";
import InvoiceFailedToPay from "../status/InvoiceFailedToPay";
import InvoicePending from "../status/InvoicePending";
import InvoiceSet from "../status/InvoiceSet";
import SwapCreated from "../status/SwapCreated";
import SwapExpired from "../status/SwapExpired";
import SwapRefunded from "../status/SwapRefunded";
import TransactionClaimPending from "../status/TransactionClaimPending";
import TransactionClaimed from "../status/TransactionClaimed";
import TransactionConfirmed from "../status/TransactionConfirmed";
import TransactionLockupFailed from "../status/TransactionLockupFailed";
import TransactionMempool from "../status/TransactionMempool";
import { getSwapStatus } from "../utils/boltzClient";
import { swapStatusFailed, swapStatusPending } from "../utils/swapStatus";

const Pay = () => {
    const params = useParams();
    const [contractTransaction, setContractTransaction] =
        createSignal(undefined);
    const [contractTransactionType, setContractTransactionType] =
        createSignal("lockup_tx");

    const { swaps, t } = useGlobalContext();
    const {
        swap,
        setSwap,
        swapStatus,
        setSwapStatus,
        swapStatusTransaction,
        setSwapStatusTransaction,
        setFailureReason,
    } = usePayContext();

    createEffect(async () => {
        let tmpSwaps = swaps();
        if (tmpSwaps) {
            const currentSwap = tmpSwaps
                .filter((s) => s.id === params.id)
                .pop();
            if (currentSwap) {
                log.debug("selecting swap", currentSwap);
                setSwap(currentSwap);
                const res = await getSwapStatus(
                    currentSwap.asset,
                    currentSwap.id,
                );
                setSwapStatus(res.status);
                setSwapStatusTransaction(res.transaction);
                setFailureReason(res.failureReason);
            }
        }
    });

    createEffect(() => {
        const tx = swapStatusTransaction();

        if (swap().asset === RBTC && tx && swap().claimTx === undefined) {
            setContractTransaction(tx.id);
        }
    });

    createEffect(() => {
        const claimTx = swap().claimTx;

        if (swap().asset === RBTC && claimTx) {
            setContractTransaction(claimTx);
            setContractTransactionType("claim_tx");
        }
    });

    createEffect(() => {
        const lockupTx = swap().lockupTx;

        if (swap().asset === RBTC && lockupTx) {
            setContractTransaction(lockupTx);
        }
    });

    onCleanup(() => {
        log.debug("cleanup Pay");
        setSwap(null);
        setSwapStatus(null);
    });

    return (
        <div data-status={swapStatus()} class="frame">
            <h2>
                {t("pay_invoice", { id: params.id })}
                <Show when={swap()}>
                    <span
                        data-reverse={swap().reverse}
                        data-asset={swap().asset}
                        class="swaplist-asset">
                        -
                    </span>
                </Show>
            </h2>
            <Show when={swap()}>
                <Show when={swap().refundTx}>
                    <p>
                        {t("status")}:{" "}
                        <span class="btn-small btn-success">
                            {swapStatusFailed.SwapRefunded}
                        </span>
                    </p>
                    <hr />
                    <SwapRefunded />
                </Show>
                <Show when={!swap().refundTx}>
                    <Show when={swapStatus() === null}>
                        <LoadingSpinner />
                    </Show>
                    <Show when={swapStatus()}>
                        <p>
                            {t("status")}:{" "}
                            <span class="btn-small">{swapStatus()}</span>
                        </p>
                        <hr />
                    </Show>
                    <Show when={swapStatus() == "swap.expired"}>
                        <SwapExpired />
                    </Show>
                    <Show when={swapStatus() == "invoice.expired"}>
                        <InvoiceExpired />
                    </Show>
                    <Show
                        when={
                            swapStatus() == "transaction.claimed" ||
                            swapStatus() == "invoice.settled"
                        }>
                        <TransactionClaimed />
                    </Show>
                    <Show when={swapStatus() == "transaction.confirmed"}>
                        <TransactionConfirmed />
                    </Show>
                    <Show when={swapStatus() == "transaction.mempool"}>
                        <TransactionMempool />
                    </Show>
                    <Show when={swapStatus() == "invoice.failedToPay"}>
                        <InvoiceFailedToPay />
                    </Show>
                    <Show when={swapStatus() == "transaction.lockupFailed"}>
                        <TransactionLockupFailed />
                    </Show>
                    <Show when={swapStatus() == "invoice.set"}>
                        <InvoiceSet />
                    </Show>
                    <Show when={swapStatus() == "invoice.pending"}>
                        <InvoicePending />
                    </Show>
                    <Show
                        when={
                            swapStatus() ===
                            swapStatusPending.TransactionClaimPending
                        }>
                        <TransactionClaimPending />
                    </Show>
                    <Show when={swapStatus() == "swap.created"}>
                        <SwapCreated />
                    </Show>

                    <Show
                        when={
                            swap().asset !== RBTC &&
                            swapStatus() !== null &&
                            swapStatus() !== "invoice.set" &&
                            swapStatus() !== "swap.created"
                        }>
                        <BlockExplorer
                            asset={swap().asset}
                            txId={swap().claimTx}
                            address={
                                !swap().reverse
                                    ? swap().address
                                    : swap().lockupAddress
                            }
                        />
                    </Show>
                    <Show
                        when={
                            swap().asset === RBTC &&
                            contractTransaction() !== undefined
                        }>
                        <BlockExplorer
                            asset={swap().asset}
                            txId={contractTransaction()}
                            typeLabel={contractTransactionType()}
                        />
                    </Show>
                </Show>
            </Show>
            <Show when={!swap()}>
                <p>{t("pay_swap_404")}</p>
            </Show>
        </div>
    );
};

export default Pay;
