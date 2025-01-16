import { useParams } from "@solidjs/router";
import log from "loglevel";
import {
    Match,
    Show,
    Switch,
    createMemo,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";

import BlockExplorerLink from "../components/BlockExplorerLink";
import LoadingSpinner from "../components/LoadingSpinner";
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
import { getSwapStatus } from "../utils/boltzClient";

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
    } = usePayContext();

    createResource(async () => {
        const currentSwap = await getSwap(params.id);

        if (currentSwap) {
            log.debug("selecting swap", currentSwap);
            setSwap(currentSwap);

            const res = await getSwapStatus(currentSwap.id);
            setSwapStatus(res.status);
            setSwapStatusTransaction(res.transaction);
            setFailureReason(res.failureReason);
        }
    });

    onCleanup(() => {
        log.debug("cleanup Pay");
        setSwap(null);
        setSwapStatus(null);
    });

    const [statusOverride, setStatusOverride] = createSignal<
        string | undefined
    >(undefined);

    const status = createMemo(() => statusOverride() || swapStatus());

    return (
        <div data-status={status()} class="frame">
            <SettingsCog />
            <h2>
                {t("pay_invoice", { id: params.id })}
                <Show when={swap()}>
                    <SwapIcons swap={swap()} />
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
                    <Show when={swapStatus()} fallback={<LoadingSpinner />}>
                        <p>
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
