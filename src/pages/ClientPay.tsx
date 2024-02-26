import log from "loglevel";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import { BTC, LBTC } from "../consts";
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
import { swapStatusFailed, swapStatusPending } from "../utils/swapStatus";

export const ClientPay = (params: { id: string }) => {
    const [swap, setSwap] = createSignal(null);
    const [reverse, setReverse] = createSignal(false);
    const [reader, setReader] = createSignal(null);
    const [notFound, setNotFound] = createSignal(false);

    const { t } = useGlobalContext();
    const { swapStatus, setSwapStatus, setFailureReason, asset, setAsset } =
        usePayContext();

    createEffect(async () => {
        // TODO: handle disconnect
        const response = await fetch(
            config().boltzClientApiUrl + `/v1/swap/${params.id}/stream`,
        );

        if (!response.ok) {
            setNotFound(true);
            return;
        }

        const reader = response.body.getReader();
        setReader(reader);

        // eslint-disable-next-line
        while (true) {
            const value = await reader.read();
            if (value.done) {
                console.log(response);
                break;
            }

            const updates = new TextDecoder()
                .decode(value.value)
                .split("\n")
                .filter((m) => m.length)
                .map((m) => JSON.parse(m));

            const update = updates[updates.length - 1];
            const swap = update.result.swap || update.result.reverseSwap;

            setSwapStatus(swap.status);
            setFailureReason(swap.error);
            setSwap(swap);
            setReverse(!!update.result.reverseSwap);

            const rawAsset = (
                reverse() ? swap.pair.to : swap.pair.from
            ).toUpperCase();
            setAsset(rawAsset == "BTC" ? BTC : LBTC);
        }
    });

    onCleanup(() => {
        log.debug("cleanup Pay");
        setSwapStatus(null);
        reader()?.cancel();
    });

    return (
        <div data-status={swapStatus()} class="frame">
            <h2>
                {t("pay_invoice", { id: params.id })}
                <Show when={swap()}>
                    <span
                        data-reverse={reverse()}
                        data-asset={asset()}
                        class="swaplist-asset">
                        -
                    </span>
                </Show>
            </h2>
            <Show when={swap()}>
                <Show when={swap().state == "REFUNDED"}>
                    <p>
                        {t("status")}:{" "}
                        <span class="btn-small btn-success">
                            {swapStatusFailed.SwapRefunded}
                        </span>
                    </p>
                    <hr />
                    <SwapRefunded refundTxId={swap().refundTransactionId} />
                </Show>
                <Show when={swap().state != "REFUNDED"}>
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
                        <InvoiceSet
                            bip21="bitcoin:bcrt1paxvzq0axlz9erzpzqdj8lz7cnlpasstqmhz6lvnmhhjvg3fpwx0qeaa9wk?amount=0.00051107&label=Send%20to%20BTC%20lightning"
                            address={swap().lockupAddress}
                            amount={swap().expectedAmount}
                        />
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
                        <SwapCreated invoice={swap().invoice} />
                    </Show>

                    <Show
                        when={
                            swapStatus() !== null &&
                            swapStatus() !== "invoice.set" &&
                            swapStatus() !== "swap.created" &&
                            asset() != ""
                        }>
                        <BlockExplorer
                            asset={asset()}
                            txId={swap().claimTransactionId}
                            address={swap().lockupAddress}
                        />
                    </Show>
                </Show>
            </Show>
            <Show when={notFound()}>
                <p>{t("pay_swap_404")}</p>
            </Show>
        </div>
    );
};

export default ClientPay;
