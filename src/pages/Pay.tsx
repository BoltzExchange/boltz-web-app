import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { getLockupTransaction, getSwapStatus } from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";
import log from "loglevel";
import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import {
    type Accessor,
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";

import BackupFlow, { BackupStep } from "../components/BackupFlow";
import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import BlockExplorerLink from "../components/BlockExplorerLink";
import LoadingSpinner from "../components/LoadingSpinner";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { SwapIcons } from "../components/SwapIcons";
import { hiddenInformation } from "../components/settings/PrivacyMode";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import Tooltip from "../components/settings/Tooltip";
import {
    type RefundableAssetType,
    type blockChainsAssets,
    refundableAssets,
} from "../consts/Assets";
import { copyIconTimeout } from "../consts/CopyContent";
import { UrlParam } from "../consts/Enums";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import CommitmentCreated from "../status/CommitmentCreated";
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
import { getSwapUTXOs } from "../utils/blockchain";
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
import type { ChainSwap, SomeSwap, SubmarineSwap } from "../utils/swapCreator";
import { getCommitmentLockupDisplayStatus } from "../utils/swapStatus";
import { getUrlParam } from "../utils/urlParams";

const Pay = () => {
    const params = useParams();
    const navigate = useNavigate();

    const initialBackupStep =
        getUrlParam(UrlParam.Backup) === BackupStep.Mnemonic
            ? BackupStep.Mnemonic
            : undefined;

    const location = useLocation<{
        timedOutRefundable?: boolean | undefined;
        waitForSwapTimeout?: boolean | undefined;
    }>();

    const { getSwap, privacyMode, rescueFileBackupDone, t } =
        useGlobalContext();

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
    const prevSwapStatus = { value: "" };

    const copyBoxText = (content: string) => {
        clipboard(content);
        setCopyDestinationActive(true);
        setTimeout(() => {
            setCopyDestinationActive(false);
        }, copyIconTimeout);
    };

    const getRefundableUTXOs = async () => {
        const currentSwap = swap();
        if (currentSwap === null) {
            return [];
        }
        const [lockupTxResult, utxosResult] = await Promise.allSettled([
            getLockupTransaction(currentSwap.id, currentSwap.type),
            getSwapUTXOs(currentSwap as ChainSwap | SubmarineSwap),
        ]);

        const lockupTx =
            lockupTxResult.status === "fulfilled" ? lockupTxResult.value : null;
        const utxos =
            utxosResult.status === "fulfilled" ? utxosResult.value : null;

        if (Object.values(swapStatusFailed).includes(swapStatus())) {
            if (!utxos && lockupTx) {
                return [lockupTx]; // if block explorers are down, we attempt to refund the lockup tx
            }

            return utxos || []; // else we consider block explorers as source of truth
        }

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

    const backupVerificationRequired = createMemo(() => {
        const currentSwap = swap();
        return (
            currentSwap !== null &&
            currentSwap.type !== SwapType.Reverse &&
            currentSwap.type !== SwapType.Commitment &&
            !rescueFileBackupDone()
        );
    });

    createResource(
        () => ({
            id: params.id,
            shouldIgnoreBackendStatus:
                timedOutRefundable() || waitForSwapTimeout(),
        }),
        async ({ id, shouldIgnoreBackendStatus }) => {
            if (id === undefined) {
                return;
            }
            const currentSwap = await getSwap(id);

            if (!currentSwap) {
                return;
            }

            // For uncooperative swaps, we don't rely on the backend for status updates
            setShouldIgnoreBackendStatus(shouldIgnoreBackendStatus);
            setSwap(currentSwap);
        },
    );

    createResource(
        () => {
            const currentSwap = swap();
            if (currentSwap === null) {
                return undefined;
            }

            return {
                backupDone: rescueFileBackupDone(),
                id: currentSwap.id,
                status: currentSwap.status,
                timedOutRefundable: timedOutRefundable(),
                type: currentSwap.type,
            };
        },
        async (currentSwap) => {
            if (
                currentSwap.type !== SwapType.Reverse &&
                currentSwap.type !== SwapType.Commitment &&
                !currentSwap.backupDone
            ) {
                return;
            }

            if (currentSwap.timedOutRefundable) {
                log.info(
                    `Refundable swap ${currentSwap.id} timed out, uncooperative refund is possible`,
                );
                setSwapStatus(swapStatusFailed.SwapWaitingForRefund);
                return;
            }

            if (currentSwap.type === SwapType.Commitment) {
                setSwapStatus(currentSwap.status ?? "commitment.created");
                return;
            }

            const res = await getSwapStatus(currentSwap.id);
            log.info(`Swap ${currentSwap.id} status fetched: ${res.status}`);
            setSwapStatus(res.status);
            setSwapStatusTransaction(res.transaction ?? {});
            setFailureReason(res.failureReason ?? "");
        },
    );

    // eslint-disable-next-line solid/reactivity
    createResource(swapStatus, async () => {
        const currentSwap = swap();

        if (currentSwap === null || backupVerificationRequired()) {
            return;
        }
        if (currentSwap.type === SwapType.Commitment) {
            return;
        }
        const swapValue = currentSwap;

        // no need to check UTXOs for non-refundable assets
        if (!refundableAssets.includes(currentSwap.assetSend)) {
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
            currentSwap.type === SwapType.Reverse
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
                : [
                      await getLockupTransaction(
                          currentSwap.id,
                          currentSwap.type,
                      ),
                  ];

            if (utxos === null || utxos === undefined) {
                setRefundableUTXOs([]);
                log.debug(
                    "Failed to get refundable UTXOs for swap:",
                    swapValue.id,
                );
                return;
            }

            setRefundableUTXOs(utxos);

            if (utxos.length > 0) {
                if (
                    isRefundableSwapType(currentSwap) &&
                    !timedOutRefundable()
                ) {
                    const timeoutBlockHeight =
                        currentSwap.type === SwapType.Submarine
                            ? (currentSwap as SubmarineSwap).timeoutBlockHeight
                            : (currentSwap as ChainSwap).lockupDetails
                                  .timeoutBlockHeight;

                    try {
                        const currentBlockHeight = (
                            await getCurrentBlockHeight([currentSwap])
                        )?.[currentSwap.assetSend as RefundableAssetType];

                        if (
                            typeof currentBlockHeight === "number" &&
                            hasSwapTimedOut(currentSwap, currentBlockHeight)
                        ) {
                            setTimedOutRefundable(true);
                            setWaitForTimeout(false);
                            setTimeoutBlockHeight(timeoutBlockHeight);
                            setTimeoutEta(0);
                            setSwapStatus(
                                swapStatusFailed.SwapWaitingForRefund,
                            );
                            setShouldIgnoreBackendStatus(true);
                            log.info(
                                "Swap timed out, uncooperative refund is possible. Status:",
                                swapStatus(),
                            );
                            return;
                        }

                        if (
                            currentBlockHeight !== undefined &&
                            (waitForSwapTimeout() ||
                                (swapValue.status !== undefined &&
                                    Object.values(swapStatusSuccess).includes(
                                        swapValue.status,
                                    )))
                        ) {
                            const timeoutEta = getTimeoutEta(
                                swapValue.assetSend as blockChainsAssets,
                                timeoutBlockHeight,
                                currentBlockHeight,
                            );

                            setWaitForTimeout(true);
                            setTimeoutEta(timeoutEta);
                            setTimeoutBlockHeight(timeoutBlockHeight);
                        }
                    } catch (e) {
                        log.error(
                            `failed to get uncooperative timeout ETA for swap ${currentSwap.id}:`,
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
        setSwapStatus("");
        setRefundableUTXOs([]);
        setShouldIgnoreBackendStatus(false);
    });

    const [statusOverride, setStatusOverride] = createSignal<
        string | undefined
    >(undefined);

    const backendRefunded = createMemo(
        () =>
            swap() !== null &&
            swap()!.type === SwapType.Chain &&
            swapStatus() === swapStatusFailed.TransactionRefunded,
    ); // this status means backend refunded its own tx. We rename it to avoid confusing users.

    const renameSwapStatus = (status: string) => {
        if (backendRefunded() || waitForSwapTimeout() || timedOutRefundable()) {
            const newStatus = swapStatusFailed.SwapWaitingForRefund;
            log.info("Swap status renamed:", newStatus);
            return newStatus;
        }

        return status;
    };

    const displaySwapStatus = createMemo(() =>
        getCommitmentLockupDisplayStatus(swap(), swapStatus()),
    );

    const status = createMemo(
        () => statusOverride() || renameSwapStatus(displaySwapStatus()),
    );
    const displaySwapId = () => {
        if (privacyMode()) {
            return hiddenInformation;
        }

        return swap()?.id ?? params.id!;
    };
    const title = () =>
        swap()?.type === SwapType.Commitment
            ? t("swap")
            : t("pay_invoice", { id: displaySwapId() });

    return (
        <Show
            when={swap()}
            fallback={
                <div class="frame">
                    <h2 class="not-found">{t("pay_swap_404")}</h2>
                    <SettingsMenu />
                </div>
            }>
            <Show
                when={!backupVerificationRequired()}
                fallback={
                    <div class="frame">
                        <BackupFlow
                            resetKey={params.id}
                            initialStep={initialBackupStep}
                        />
                        <SettingsMenu />
                    </div>
                }>
                <div data-status={status()} class="frame">
                    <span class="frame-header">
                        <h2>
                            {title()}
                            <Show when={swap()}>
                                <SwapIcons swap={swap()!} />
                            </Show>
                        </h2>
                        <SettingsCog />
                    </span>
                    <Show when={!loading()} fallback={<LoadingSpinner />}>
                        <Show when={swap()?.refundTx !== undefined}>
                            <p class="swap-status">
                                {t("status")}:{" "}
                                <span class="btn-small btn-success">
                                    {swapStatusFailed.SwapRefunded}
                                </span>
                            </p>
                            <hr />
                            <SwapRefunded refundTxId={swap()!.refundTx!} />
                        </Show>

                        <Show when={swap()?.refundTx === undefined}>
                            <Show
                                when={swapStatus()}
                                fallback={<LoadingSpinner />}>
                                <Show
                                    when={swap()?.type !== SwapType.Commitment}>
                                    <div class="swap-status">
                                        {t("status")}:
                                        <span class="btn-small">
                                            {status()}
                                        </span>
                                        <Show
                                            when={
                                                getDestinationAddress(swap()) &&
                                                (displaySwapStatus() ===
                                                    swapStatusPending.SwapCreated ||
                                                    displaySwapStatus() ===
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
                                                    isMobile()
                                                        ? "left"
                                                        : "right",
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
                                                            <BiRegularCopy
                                                                size={14}
                                                            />
                                                        }>
                                                        <IoCheckmark
                                                            size={14}
                                                        />
                                                    </Show>
                                                    {t("destination")}
                                                </button>
                                            </Tooltip>
                                        </Show>
                                    </div>
                                </Show>
                                <hr />
                            </Show>
                            <Show
                                when={!waitForSwapTimeout()}
                                fallback={
                                    <>
                                        <RefundEta
                                            timeoutEta={timeoutEta}
                                            timeoutBlockHeight={
                                                timeoutBlockHeight
                                            }
                                            asset={swap()!.assetSend}
                                        />
                                        <BlockExplorer
                                            asset={swap()!.assetSend}
                                            kind={
                                                swap()!.lockupTx !== undefined
                                                    ? BlockExplorerTargetKind.Tx
                                                    : BlockExplorerTargetKind.Address
                                            }
                                            id={
                                                swap()!.lockupTx !== undefined
                                                    ? swap()!.lockupTx!
                                                    : swap()!.type ===
                                                        SwapType.Submarine
                                                      ? (
                                                            swap() as SubmarineSwap
                                                        ).address
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
                                            swap()?.type === SwapType.Commitment
                                        }>
                                        <CommitmentCreated />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                                swapStatusSuccess.TransactionClaimed ||
                                            displaySwapStatus() ===
                                                swapStatusSuccess.InvoiceSettled ||
                                            displaySwapStatus() ===
                                                swapStatusPending.TransactionClaimPending ||
                                            displaySwapStatus() ===
                                                swapStatusPending.InvoicePaid
                                        }>
                                        <TransactionClaimed />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                            swapStatusFailed.InvoiceFailedToPay
                                        }>
                                        <InvoiceFailedToPay />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                                swapStatusFailed.TransactionLockupFailed ||
                                            displaySwapStatus() ===
                                                swapStatusFailed.TransactionFailed
                                        }>
                                        <TransactionLockupFailed
                                            setStatusOverride={
                                                setStatusOverride
                                            }
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
                                        />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                            swapStatusFailed.SwapExpired
                                        }>
                                        <SwapExpired />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                            swapStatusFailed.InvoiceExpired
                                        }>
                                        <InvoiceExpired />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                                swapStatusPending.TransactionConfirmed ||
                                            displaySwapStatus() ===
                                                swapStatusPending.TransactionServerConfirmed
                                        }>
                                        <TransactionConfirmed />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                                swapStatusPending.TransactionMempool ||
                                            displaySwapStatus() ===
                                                swapStatusPending.TransactionServerMempool
                                        }>
                                        <TransactionMempool swap={swap} />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                            swapStatusPending.InvoiceSet
                                        }>
                                        <InvoiceSet />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                            swapStatusPending.InvoicePending
                                        }>
                                        <InvoicePending />
                                    </Match>
                                    <Match
                                        when={
                                            displaySwapStatus() ===
                                            swapStatusPending.SwapCreated
                                        }>
                                        <SwapCreated />
                                    </Match>
                                </Switch>
                                <Show
                                    when={swap()?.type !== SwapType.Commitment}>
                                    <BlockExplorerLink
                                        swap={swap as Accessor<SomeSwap>}
                                        swapStatus={displaySwapStatus}
                                    />
                                </Show>
                            </Show>
                        </Show>
                    </Show>
                    <SettingsMenu />
                </div>
            </Show>
        </Show>
    );
};

export default Pay;
