import { useParams } from "@solidjs/router";
import log from "loglevel";
import {
    Accessor,
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";

import BlockExplorerLink from "../components/BlockExplorerLink";
import LoadingSpinner from "../components/LoadingSpinner";
import RefundButton from "../components/RefundButton";
import { SwapIcons } from "../components/SwapIcons";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { SwapType } from "../consts/Enums";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import InvoiceExpired from "../status/InvoiceExpired";
import InvoiceFailedToPay from "../status/InvoiceFailedToPay";
import InvoicePending from "../status/InvoicePending";
import InvoiceSet from "../status/InvoiceSet";
import SwapCreated from "../status/SwapCreated";
import SwapExpired from "../status/SwapExpired";
import SwapRefunded from "../status/SwapRefunded";
import TransactionClaimed from "../status/TransactionClaimed";
import TransactionConfirmed from "../status/TransactionConfirmed";
import TransactionLockupFailed from "../status/TransactionLockupFailed";
import TransactionMempool from "../status/TransactionMempool";
import { getLockupTransaction, getSwapStatus } from "../utils/boltzClient";
import { getRefundableUTXOs, isSwapRefundable } from "../utils/refund";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const Pay = () => {
    const params = useParams();

    const { getSwap, t } = useGlobalContext();

    const {
        swap,
        setSwap,
        swapStatus,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setRefundableUTXOs,
    } = usePayContext();

    const prevSwapStatus = { value: "" };

    createEffect(() => {
        prevSwapStatus.value = swapStatus();
    });

    createResource(async () => {
        const currentSwap = await getSwap(params.id);

        if (currentSwap) {
            setSwap(currentSwap);
            const res = await getSwapStatus(currentSwap.id);
            setSwapStatus(res.status);
            setSwapStatusTransaction(res.transaction);
            setFailureReason(res.failureReason);
        }
    });

    createResource(swapStatus, async () => {
        const isInitialSwapState =
            (swapStatus() === swapStatusPending.SwapCreated &&
                prevSwapStatus.value === "") ||
            (swapStatus() === swapStatusPending.InvoiceSet &&
                prevSwapStatus.value === "");

        // No need to fetch UTXO data for a swap just created
        if (isInitialSwapState) {
            return;
        }

        // We don't check the block explorer during the initial phase
        // of a swap because, more often than not, it doesn't have
        // information about the lockup transaction yet.
        const shouldCheckBlockExplorer =
            swapStatus() !== swapStatusPending.InvoiceSet &&
            prevSwapStatus.value !== swapStatusPending.InvoiceSet &&
            swapStatus() !== swapStatusPending.SwapCreated &&
            prevSwapStatus.value !== swapStatusPending.SwapCreated &&
            isSwapRefundable(swap());

        try {
            const utxos = shouldCheckBlockExplorer
                ? await getRefundableUTXOs(swap() as ChainSwap | SubmarineSwap)
                : [await getLockupTransaction(swap().id, swap().type)];

            setRefundableUTXOs(utxos);

            if (utxos.length > 0) {
                // if there are remaining UTXOs, we consider we don't have a refundTx yet
                setSwap({ ...swap(), refundTx: "" });
            }
        } catch (e) {
            log.debug("error fetching UTXOs: ", e.stack);
        }
    });

    onCleanup(() => {
        log.debug("cleanup Pay");
        setSwap(null);
        setSwapStatus(null);
        setRefundableUTXOs([]);
    });

    const [statusOverride, setStatusOverride] = createSignal<
        string | undefined
    >(undefined);

    const renameSwapStatus = (status: string) => {
        if (
            swap()?.type === SwapType.Chain &&
            status === swapStatusFailed.TransactionRefunded
        ) {
            // Rename because the previous name was confusing users
            return "swap.waitingForRefund";
        }
        return status;
    };

    const status = createMemo(
        () => statusOverride() || renameSwapStatus(swapStatus()),
    );

    return (
        <div data-status={status()} class="frame">
            <span class="frame-header">
                <h2>
                    {t("pay_invoice", { id: params.id })}
                    <Show when={swap()}>
                        <SwapIcons swap={swap()} />
                    </Show>
                </h2>
                <SettingsCog />
            </span>
            <Show when={swap()}>
                <Show when={swap().refundTx}>
                    <p class="swap-status">
                        {t("status")}:{" "}
                        <span class="btn-small btn-success">
                            {swapStatusFailed.SwapRefunded}
                        </span>
                    </p>
                    <hr />
                    <SwapRefunded />
                </Show>

                <Show when={!swap().refundTx}>
                    <Show when={swapStatus()} fallback={<LoadingSpinner />}>
                        <p class="swap-status">
                            {t("status")}:{" "}
                            <span class="btn-small">{status()}</span>
                        </p>
                        <hr />
                    </Show>
                    <Switch>
                        <Match
                            when={
                                swapStatus() ===
                                    swapStatusSuccess.TransactionClaimed ||
                                swapStatus() ===
                                    swapStatusSuccess.InvoiceSettled ||
                                swapStatus() ===
                                    swapStatusPending.TransactionClaimPending
                            }>
                            <TransactionClaimed />
                        </Match>
                        <Match
                            when={
                                swapStatus() ===
                                swapStatusFailed.InvoiceFailedToPay
                            }>
                            <InvoiceFailedToPay />
                        </Match>
                        <Match
                            when={
                                swapStatus() ===
                                    swapStatusFailed.TransactionLockupFailed ||
                                (swap().type === SwapType.Chain &&
                                    swapStatus() ===
                                        swapStatusFailed.TransactionFailed)
                            }>
                            <TransactionLockupFailed
                                setStatusOverride={setStatusOverride}
                            />
                        </Match>
                        <Match
                            when={
                                swap().type === SwapType.Chain &&
                                swapStatus() ===
                                    swapStatusFailed.TransactionRefunded
                            }>
                            <RefundButton swap={swap as Accessor<ChainSwap>} />
                        </Match>
                        <Match
                            when={
                                swapStatus() === swapStatusFailed.SwapExpired
                            }>
                            <SwapExpired />
                        </Match>
                        <Match
                            when={
                                swapStatus() === swapStatusFailed.InvoiceExpired
                            }>
                            <InvoiceExpired />
                        </Match>
                        <Match
                            when={
                                swapStatus() ===
                                    swapStatusPending.TransactionConfirmed ||
                                swapStatus() ===
                                    swapStatusPending.TransactionServerConfirmed
                            }>
                            <TransactionConfirmed />
                        </Match>
                        <Match
                            when={
                                swapStatus() ===
                                    swapStatusPending.TransactionMempool ||
                                swapStatus() ===
                                    swapStatusPending.TransactionServerMempool
                            }>
                            <TransactionMempool />
                        </Match>
                        <Match
                            when={
                                swapStatus() === swapStatusPending.InvoiceSet
                            }>
                            <InvoiceSet />
                        </Match>
                        <Match
                            when={
                                swapStatus() ===
                                swapStatusPending.InvoicePending
                            }>
                            <InvoicePending />
                        </Match>
                        <Match
                            when={
                                swapStatus() === swapStatusPending.SwapCreated
                            }>
                            <SwapCreated />
                        </Match>
                    </Switch>
                    <BlockExplorerLink swap={swap} swapStatus={swapStatus} />
                </Show>
            </Show>
            <Show when={!swap()}>
                <h2 class="not-found">{t("pay_swap_404")}</h2>
            </Show>
            <SettingsMenu />
        </div>
    );
};

export default Pay;
