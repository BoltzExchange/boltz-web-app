import log from "loglevel";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import t from "./i18n";
import { RBTC } from "./consts.js";
import { useParams } from "@solidjs/router";
import InvoiceSet from "./status/InvoiceSet";
import SwapCreated from "./status/SwapCreated";
import SwapExpired from "./status/SwapExpired";
import SwapRefunded from "./status/SwapRefunded";
import InvoicePending from "./status/InvoicePending";
import InvoiceExpired from "./status/InvoiceExpired";
import { swapStatusFailed } from "./utils/swapStatus";
import BlockExplorer from "./components/BlockExplorer";
import { qr, fetcher, checkForFailed } from "./helper";
import LoadingSpinner from "./components/LoadingSpinner";
import InvoiceFailedToPay from "./status/InvoiceFailedToPay";
import TransactionClaimed from "./status/TransactionClaimed";
import TransactionMempool from "./status/TransactionMempool";
import TransactionConfirmed from "./status/TransactionConfirmed";
import TransactionLockupFailed from "./status/TransactionLockupFailed";
import {
    swap,
    swaps,
    setSwap,
    setReverse,
    swapStatus,
    setInvoiceQr,
    setSwapStatus,
    setFailureReason,
    swapStatusTransaction,
    setSwapStatusTransaction,
} from "./signals";

const Pay = () => {
    const params = useParams();
    const [ethereumTransaction, setEthereumTransaction] =
        createSignal(undefined);
    const [ethereumTransactionType, setEthereumTransactionType] =
        createSignal("lockup_tx");

    createEffect(() => {
        let tmpSwaps = swaps();
        if (tmpSwaps) {
            const currentSwap = tmpSwaps
                .filter((s) => s.id === params.id)
                .pop();
            if (currentSwap) {
                log.debug("selecting swap", currentSwap);
                setSwap(currentSwap);
                setReverse(currentSwap.reverse);
                fetcher(
                    "/swapstatus",
                    (data) => {
                        setSwapStatus(data.status);
                        setSwapStatusTransaction(data.transaction);
                        checkForFailed(currentSwap.id, data);
                        setFailureReason(data.failureReason);
                    },
                    { id: currentSwap.id },
                );
                qr(
                    currentSwap.reverse
                        ? currentSwap.invoice
                        : currentSwap.bip21,
                    setInvoiceQr,
                );
            }
        }
    });

    createEffect(() => {
        const tx = swapStatusTransaction();

        if (swap().asset === RBTC && tx && swap().claimTx === undefined) {
            setEthereumTransaction(tx.id);
        }
    });

    createEffect(() => {
        const claimTx = swap().claimTx;

        if (swap().asset === RBTC && claimTx) {
            setEthereumTransaction(claimTx);
            setEthereumTransactionType("claim_tx");
        }
    });

    createEffect(() => {
        const lockupTx = swap().lockupTx;

        if (swap().asset === RBTC && lockupTx) {
            setEthereumTransaction(lockupTx);
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
                        class="past-asset">
                        -
                    </span>
                </Show>
            </h2>
            <p>{t("pay_invoice_subline")}</p>
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
                    <Show when={swapStatus() == "swap.created"}>
                        <SwapCreated />
                    </Show>

                    <Show
                        when={
                            swap().asset !== RBTC &&
                            swapStatus() !== null &&
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
                            ethereumTransaction() !== undefined
                        }>
                        <BlockExplorer
                            asset={swap().asset}
                            txId={ethereumTransaction()}
                            typeLabel={ethereumTransactionType()}
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
