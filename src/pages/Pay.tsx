import { useParams } from "@solidjs/router";
import log from "loglevel";
import {
    Accessor,
    Show,
    createEffect,
    createSignal,
    onCleanup,
} from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import SettingsCog from "../components/SettingsCog";
import SettingsMenu from "../components/SettingsMenu";
import { SwapIcons } from "../components/SwapIcons";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { swapStatusFailed, swapStatusPending } from "../consts/SwapStatus";
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
import {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
    getRelevantAssetForSwap,
} from "../utils/swapCreator";

enum TransactionType {
    Lockup = "lockup_tx",
    Claim = "claim_tx",
}

const BlockExplorerLink = ({
    swap,
    swapStatus,
    contractTransaction,
    contractTransactionType,
}: {
    swap: Accessor<SomeSwap>;
    swapStatus: Accessor<string>;
    contractTransaction: Accessor<string>;
    contractTransactionType: Accessor<TransactionType>;
}) => {
    // Refund transactions are handled SwapRefunded

    if (swap().type !== SwapType.Chain) {
        return (
            <Show when={swap().type !== SwapType.Chain}>
                <Show
                    when={
                        getRelevantAssetForSwap(swap()) &&
                        swapStatus() !== null &&
                        swapStatus() !== "invoice.set" &&
                        swapStatus() !== "swap.created"
                    }>
                    <BlockExplorer
                        asset={getRelevantAssetForSwap(swap())}
                        txId={swap().claimTx}
                        address={
                            swap().type === SwapType.Submarine
                                ? (swap() as SubmarineSwap).address
                                : (swap() as ReverseSwap).lockupAddress
                        }
                    />
                </Show>
                <Show
                    when={
                        getRelevantAssetForSwap(swap()) &&
                        contractTransaction() !== undefined
                    }>
                    <BlockExplorer
                        asset={getRelevantAssetForSwap(swap())}
                        txId={contractTransaction()}
                        typeLabel={contractTransactionType()}
                    />
                </Show>
            </Show>
        );
    }

    // TODO: RSK
    // TODO: how to show server lockup?

    const [hasBeenClaimed, setHasBeenClaimed] = createSignal<boolean>(false);
    const asset = () =>
        hasBeenClaimed() ? swap().assetReceive : swap().assetSend;

    createEffect(() => {
        setHasBeenClaimed(swap().claimTx !== undefined);
    });

    return (
        <BlockExplorer
            asset={asset()}
            txId={swap().claimTx}
            address={
                hasBeenClaimed
                    ? undefined
                    : (swap() as ChainSwap).lockupDetails.lockupAddress
            }
        />
    );
};

const Pay = () => {
    const params = useParams();
    const [contractTransaction, setContractTransaction] =
        createSignal<string>(undefined);
    const [contractTransactionType, setContractTransactionType] = createSignal(
        TransactionType.Lockup,
    );

    const { getSwap, t } = useGlobalContext();
    const {
        swap,
        setSwap,
        swapStatus,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
    } = usePayContext();

    createEffect(async () => {
        const currentSwap = await getSwap(params.id);
        if (currentSwap) {
            log.debug("selecting swap", currentSwap);
            setSwap(currentSwap);
            const asset = getRelevantAssetForSwap(currentSwap);
            const res = await getSwapStatus(asset, currentSwap.id);
            setSwapStatus(res.status);
            setSwapStatusTransaction(res.transaction);
            setFailureReason(res.failureReason);

            // RSK
            if (
                asset === RBTC &&
                res.transaction &&
                currentSwap.claimTx === undefined
            ) {
                setContractTransaction(res.transaction.id);
            }

            if (asset === RBTC && currentSwap["lockupTx"]) {
                setContractTransaction(currentSwap["lockupTx"]);
            }

            if (asset === RBTC && currentSwap.claimTx) {
                setContractTransaction(currentSwap.claimTx);
                setContractTransactionType(TransactionType.Claim);
            }
        }
    });

    onCleanup(() => {
        log.debug("cleanup Pay");
        setSwap(null);
        setSwapStatus(null);
    });

    return (
        <div data-status={swapStatus()} class="frame">
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
                    <Show
                        when={
                            swapStatus() == "transaction.confirmed" ||
                            swapStatus() ===
                                swapStatusPending.TransactionServerConfirmed
                        }>
                        <TransactionConfirmed />
                    </Show>
                    <Show
                        when={
                            swapStatus() === "transaction.mempool" ||
                            swapStatus() === "transaction.server.mempool"
                        }>
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

                    <BlockExplorerLink
                        swap={swap}
                        swapStatus={swapStatus}
                        contractTransaction={contractTransaction}
                        contractTransactionType={contractTransactionType}
                    />
                </Show>
            </Show>
            <Show when={!swap()}>
                <p>{t("pay_swap_404")}</p>
            </Show>
            <SettingsMenu />
        </div>
    );
};

export default Pay;
