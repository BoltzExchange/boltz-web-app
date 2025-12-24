import { useLocation, useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import type { Accessor } from "solid-js";
import {
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";
import { getSwapUTXOs } from "src/utils/blockchain";

import BlockExplorer from "../components/BlockExplorer";
import BlockExplorerLink from "../components/BlockExplorerLink";
import LoadingSpinner from "../components/LoadingSpinner";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { SwapIcons } from "../components/SwapIcons";
import { hiddenInformation } from "../components/settings/PrivacyMode";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import Tooltip from "../components/settings/Tooltip";
import { type RefundableAssetType, refundableAssets } from "../consts/Assets";
import { copyIconTimeout } from "../consts/CopyContent";
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
import {
    clipboard,
    cropString,
    getDestinationAddress,
    isMobile,
} from "../utils/helper";
import {
    getCurrentBlockHeight,
    getTimeoutEta,
    hasSwapTimedOut,
    isRefundableSwapType,
} from "../utils/rescue";
import { type ChainSwap, type SubmarineSwap } from "../utils/swapCreator";

const Pay = () => {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation<{
        timedOutRefundable?: boolean | undefined;
        waitForSwapTimeout?: boolean | undefined;
    }>();

    const { getSwap, t, privacyMode } = useGlobalContext();

    const {
        swap,
        setSwap,
        swapStatus,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setRefundableUTXOs,
        setShouldIgnoreBackendStatus,
    } = usePayContext();

    const [timeoutEta, setTimeoutEta] = createSignal<number>(0);
    const [timeoutBlockHeight, setTimeoutBlockHeight] = createSignal<number>(0);
    const [timedOutRefundable, setTimedOutRefundable] = createSignal<boolean>(
        location.state?.timedOutRefundable ?? false,
    );
    const [waitForSwapTimeout, setWaitForTimeout] = createSignal<boolean>(
        location.state?.waitForSwapTimeout ?? false,
    );
    const [copyDestinationActive, setCopyDestinationActive] =
        createSignal(false);
    const [loading, setLoading] = createSignal<boolean>(false);
    const [refundTxId, setRefundTxId] = createSignal<string>("");

    const prevSwapStatus = { value: "" };

    const copyBoxText = (content: string) => {
        clipboard(content);
        setCopyDestinationActive(true);
        setTimeout(() => {
            setCopyDestinationActive(false);
        }, copyIconTimeout);
    };

    const getRefundableUTXOs = async () => {
        const [lockupTxResult, utxosResult] = await Promise.allSettled([
            getLockupTransaction(swap().id, swap().type),
            getSwapUTXOs(swap() as ChainSwap | SubmarineSwap),
        ]);

        const lockupTx =
            lockupTxResult.status === "fulfilled" ? lockupTxResult.value : null;
        const utxos =
            utxosResult.status === "fulfilled" ? utxosResult.value : null;

        // to avoid the racing condition where WebApp has broadcast the claim tx for the lockup address
        // but it hasn't reached block explorers yet
        if (utxos?.length === 1 && utxos[0].id === lockupTx?.id) {
            return [];
        }

        return utxos;
    };

    createEffect(() => {
        prevSwapStatus.value = swapStatus();
    });

    createResource(async () => {
        const currentSwap = await getSwap(params.id);

        if (!currentSwap) {
            return;
        }

        // For uncooperative swaps, we don't rely on the backend for status updates
        setShouldIgnoreBackendStatus(
            timedOutRefundable() || waitForSwapTimeout(),
        );
        setSwap(currentSwap);

        if (timedOutRefundable()) {
            log.info(
                `refundable swap ${currentSwap.id} timed out, uncooperative refund is possible`,
            );
            setSwapStatus(swapStatusFailed.SwapWaitingForRefund);
            return;
        }

        const res = await getSwapStatus(currentSwap.id);
        setSwapStatus(res.status);
        setSwapStatusTransaction(res.transaction);
        setFailureReason(res.failureReason);
    });

    // eslint-disable-next-line solid/reactivity
    createResource(swapStatus, async () => {
        // no need to check UTXOs for non-refundable assets
        if (!refundableAssets.includes(swap().assetSend)) {
            return;
        }

        const emptyPrevSwapStatus =
            prevSwapStatus.value === undefined ||
            prevSwapStatus.value === null ||
            prevSwapStatus.value === "";

        const isInitialSwapState =
            emptyPrevSwapStatus &&
            (swapStatus() === swapStatusPending.SwapCreated ||
                swapStatus() === swapStatusPending.InvoiceSet);

        const preClaimStatuses = [
            swapStatusPending.TransactionServerMempool,
            swapStatusPending.TransactionClaimPending,
            swapStatusPending.InvoicePaid,
        ];

        const swapJustClaimed =
            preClaimStatuses.includes(prevSwapStatus.value) &&
            swapStatus() === swapStatusSuccess.TransactionClaimed;

        // No need to fetch UTXO data for a reverse swap or a swaps in initial state
        if (
            isInitialSwapState ||
            swapJustClaimed ||
            swapStatus() === swapStatusPending.InvoicePaid ||
            swapStatus() === swapStatusPending.TransactionClaimPending ||
            swap().type === SwapType.Reverse
        ) {
            return;
        }

        // We don't check the block explorer during the initial phase
        // of a swap because, more often than not, it doesn't have
        // information about the lockup transaction yet.
        const initialStatuses = [
            swapStatusPending.InvoiceSet,
            swapStatusPending.SwapCreated,
        ];
        const shouldCheckBlockExplorer =
            !initialStatuses.includes(swapStatus()) &&
            !initialStatuses.includes(prevSwapStatus.value) &&
            isRefundableSwapType(swap());

        try {
            setLoading(true);

            const utxos = shouldCheckBlockExplorer
                ? await getRefundableUTXOs()
                : [await getLockupTransaction(swap().id, swap().type)];

            setRefundableUTXOs(utxos);

            if (utxos.length > 0) {
                if (isRefundableSwapType(swap()) && !timedOutRefundable()) {
                    const timeoutBlockHeight =
                        swap().type === SwapType.Submarine
                            ? (swap() as SubmarineSwap).timeoutBlockHeight
                            : (swap() as ChainSwap).lockupDetails
                                  .timeoutBlockHeight;

                    try {
                        const currentBlockHeight = (
                            await getCurrentBlockHeight([swap()])
                        )?.[swap().assetSend];

                        if (
                            typeof currentBlockHeight === "number" &&
                            hasSwapTimedOut(swap(), currentBlockHeight)
                        ) {
                            setTimedOutRefundable(true);
                            setWaitForTimeout(false);
                            setTimeoutBlockHeight(timeoutBlockHeight);
                            setTimeoutEta(0);
                            setSwapStatus(
                                swapStatusFailed.SwapWaitingForRefund,
                            );
                            setShouldIgnoreBackendStatus(true);
                            return;
                        }

                        if (
                            waitForSwapTimeout() ||
                            Object.values(swapStatusSuccess).includes(
                                swap().status,
                            )
                        ) {
                            const timeoutEta = getTimeoutEta(
                                swap().assetSend as RefundableAssetType,
                                timeoutBlockHeight,
                                currentBlockHeight,
                            );

                            setWaitForTimeout(true);
                            setTimeoutEta(timeoutEta);
                            setTimeoutBlockHeight(timeoutBlockHeight);
                        }
                    } catch (e) {
                        log.error(
                            `failed to get uncooperative timeout ETA for swap ${swap().id}:`,
                            e,
                        );
                        // if we can't obtain block height data because 3rd party explorer is down, we allow the user to attempt an uncoop refund anyway
                        setWaitForTimeout(false);
                        setTimedOutRefundable(true);
                    }
                }
            }
        } catch (e) {
            log.debug("error fetching UTXOs:", e);
        } finally {
            setLoading(false);
        }
    });

    onCleanup(() => {
        log.debug("cleanup Pay");
        setSwap(null);
        setSwapStatus(null);
        setRefundableUTXOs([]);
        setShouldIgnoreBackendStatus(false);
    });

    const [statusOverride, setStatusOverride] = createSignal<
        string | undefined
    >(undefined);

    const backendRefunded = createMemo(
        () =>
            swap() &&
            swap().type === SwapType.Chain &&
            swapStatus() === swapStatusFailed.TransactionRefunded,
    ); // this status means backend refunded its own tx. We rename it to avoid confusing users.

    const renameSwapStatus = (status: string) => {
        if (backendRefunded() || waitForSwapTimeout() || timedOutRefundable()) {
            return swapStatusFailed.SwapWaitingForRefund;
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
                    {t("pay_invoice", {
                        id: privacyMode() ? hiddenInformation : params.id,
                    })}
                    <Show when={swap()}>
                        <SwapIcons swap={swap()} />
                    </Show>
                </h2>
                <SettingsCog />
            </span>
            <Show when={!loading()} fallback={<LoadingSpinner />}>
                <Show when={swap()}>
                    <Show when={refundTxId() !== ""}>
                        <p class="swap-status">
                            {t("status")}:{" "}
                            <span class="btn-small btn-success">
                                {swapStatusFailed.SwapRefunded}
                            </span>
                        </p>
                        <hr />
                        <SwapRefunded refundTxId={refundTxId()} />
                    </Show>

                    <Show when={refundTxId() === ""}>
                        <Show when={swapStatus()} fallback={<LoadingSpinner />}>
                            <div class="swap-status">
                                {t("status")}:
                                <span class="btn-small">{status()}</span>
                                <Show
                                    when={
                                        getDestinationAddress(swap()) &&
                                        (swapStatus() ===
                                            swapStatusPending.SwapCreated ||
                                            swapStatus() ===
                                                swapStatusPending.InvoiceSet)
                                    }>
                                    <span class="vertical-line" />
                                    <Tooltip
                                        pxDistance={20}
                                        label={{
                                            key: "destination_address",
                                            variables: {
                                                address: cropString(
                                                    getDestinationAddress(
                                                        swap(),
                                                    ),
                                                    14,
                                                    8,
                                                ),
                                            },
                                        }}
                                        direction={[
                                            "top",
                                            isMobile() ? "left" : "right",
                                        ]}>
                                        <button
                                            id="copy-destination"
                                            onClick={() =>
                                                copyBoxText(
                                                    getDestinationAddress(
                                                        swap(),
                                                    ),
                                                )
                                            }>
                                            <Show
                                                when={copyDestinationActive()}
                                                fallback={
                                                    <BiRegularCopy size={14} />
                                                }>
                                                <IoCheckmark size={14} />
                                            </Show>
                                            {t("destination")}
                                        </button>
                                    </Tooltip>
                                </Show>
                            </div>
                            <hr />
                        </Show>
                        <Show
                            when={!waitForSwapTimeout()}
                            fallback={
                                <>
                                    <RefundEta
                                        timeoutEta={timeoutEta}
                                        timeoutBlockHeight={timeoutBlockHeight}
                                        refundableAsset={swap().assetSend}
                                    />
                                    <BlockExplorer
                                        asset={swap().assetSend}
                                        txId={swap().lockupTx}
                                        address={
                                            swap().type === SwapType.Submarine
                                                ? (swap() as SubmarineSwap)
                                                      .address
                                                : (swap() as ChainSwap)
                                                      .lockupDetails
                                                      .lockupAddress
                                        }
                                    />
                                    <button
                                        class="btn btn-light"
                                        data-testid="backBtn"
                                        onClick={() => {
                                            navigate(-1);
                                        }}>
                                        {t("back")}
                                    </button>
                                </>
                            }>
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
                                        swapStatus() ===
                                            swapStatusFailed.TransactionFailed
                                    }>
                                    <TransactionLockupFailed
                                        setStatusOverride={setStatusOverride}
                                    />
                                </Match>
                                <Match
                                    when={
                                        timedOutRefundable() ||
                                        backendRefunded()
                                    }>
                                    <RefundButton
                                        swap={
                                            swap as Accessor<
                                                ChainSwap | SubmarineSwap
                                            >
                                        }
                                        setRefundTxId={setRefundTxId}
                                    />
                                </Match>
                                <Match
                                    when={
                                        swapStatus() ===
                                        swapStatusFailed.SwapExpired
                                    }>
                                    <SwapExpired />
                                </Match>
                                <Match
                                    when={
                                        swapStatus() ===
                                        swapStatusFailed.InvoiceExpired
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
                                    <TransactionMempool swap={swap} />
                                </Match>
                                <Match
                                    when={
                                        swapStatus() ===
                                        swapStatusPending.InvoiceSet
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
                                        swapStatus() ===
                                        swapStatusPending.SwapCreated
                                    }>
                                    <SwapCreated />
                                </Match>
                            </Switch>
                            <BlockExplorerLink
                                swap={swap}
                                swapStatus={swapStatus}
                            />
                        </Show>
                    </Show>
                </Show>
                <Show when={!swap()}>
                    <h2 class="not-found">{t("pay_swap_404")}</h2>
                </Show>
            </Show>
            <SettingsMenu />
        </div>
    );
};

export default Pay;
