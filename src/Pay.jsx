import log from "loglevel";
import { createEffect, onCleanup } from "solid-js";
import {
    setFailureReason,
    setSwapStatusTransaction,
    setReverse,
    setInvoiceQr,
    swap,
    setSwap,
    swapStatus,
    setSwapStatus,
    swaps,
} from "./signals";
import { useParams } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { qr, claim, checkForFailed, fetchSwapStatus } from "./helper";
import { api_url } from "./config";
import InvoiceSet from "./status/InvoiceSet";
import InvoicePending from "./status/InvoicePending";
import InvoiceExpired from "./status/InvoiceExpired";
import InvoiceFailedToPay from "./status/InvoiceFailedToPay";
import TransactionMempool from "./status/TransactionMempool";
import TransactionConfirmed from "./status/TransactionConfirmed";
import TransactionLockupFailed from "./status/TransactionLockupFailed";
import TransactionClaimed from "./status/TransactionClaimed";
import SwapRefunded from "./status/SwapRefunded";
import SwapExpired from "./status/SwapExpired";
import SwapCreated from "./status/SwapCreated";
import BlockExplorer from "./components/BlockExplorer";

const Pay = () => {
    const params = useParams();
    const [t] = useI18n();

    let stream = null;

    createEffect(() => {
        let tmp_swaps = swaps();
        if (tmp_swaps) {
            let current_swap = tmp_swaps
                .filter((s) => s.id === params.id)
                .pop();
            if (current_swap) {
                log.debug("selecting swap", current_swap);
                setSwap(current_swap);
                fetchSwapStatus(current_swap);
                setReverse(current_swap.reverse);
                qr(
                    current_swap.reverse
                        ? current_swap.invoice
                        : current_swap.bip21,
                    setInvoiceQr
                );
                if (stream) {
                    log.debug("stream closed");
                    stream.close();
                }
                let stream_url = `${api_url}/streamswapstatus?id=${params.id}`;
                stream = new EventSource(stream_url);
                log.debug(`stream started: ${stream_url}`);
                stream.onmessage = function (event) {
                    const data = JSON.parse(event.data);
                    log.debug(`Event status update: ${data.status}`, data);
                    setSwapStatus(data.status);
                    setSwapStatusTransaction(data.transaction);
                    if (
                        data.status == "transaction.confirmed" &&
                        data.transaction
                    ) {
                        claim(current_swap);
                    }
                    checkForFailed(current_swap.id, data);
                    setFailureReason(data.failureReason);
                };
            }
        }
    });

    onCleanup(() => {
        log.debug("cleanup Pay");
        if (stream) {
            log.debug("stream closed");
            stream.close();
        }
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
                        Status:{" "}
                        <span class="btn-small btn-success">swap.refunded</span>
                    </p>
                    <hr />
                    <SwapRefunded />
                </Show>
                <Show when={!swap().refundTx}>
                    <p>
                        Status: <span class="btn-small">{swapStatus()}</span>
                    </p>
                    <hr />
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
                    <Show when={swapStatus() != "swap.created"}>
                        <BlockExplorer
                            asset={swap().asset}
                            address={
                                !swap().reverse
                                    ? swap().address
                                    : swap().lockupAddress
                            }
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
