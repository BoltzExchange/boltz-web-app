import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { OutputType } from "boltz-core";
import {
    type ChainSwapDetails,
    type RestorableSwap,
    getSwapStatus,
} from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";
import log from "loglevel";
import {
    type Accessor,
    Match,
    Show,
    Switch,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import SwapHeader from "../components/SwapHeader";
import { getSwapIconAssets } from "../components/SwapIcons";
import SettingsMenu from "../components/settings/SettingsMenu";
import {
    type AssetType,
    type RefundableAssetType,
    type blockChainsAssets,
    isEvmAsset,
} from "../consts/Assets";
import { swapStatusFailed } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useRescueContext } from "../context/Rescue";
import type { DictKey } from "../i18n/i18n";
import { ECPair } from "../utils/ecpair";
import {
    getCurrentBlockHeight,
    getRescuableUTXOs,
    getTimeoutEta,
} from "../utils/rescue";
import { deriveKey } from "../utils/rescueFile";
import type { ChainSwap, SomeSwap, SubmarineSwap } from "../utils/swapCreator";

export const mapSwap = (
    swap?: RestorableSwap,
): Partial<SomeSwap> | undefined => {
    if (swap === undefined) {
        return undefined;
    }

    switch (swap.type) {
        case SwapType.Submarine: {
            const refund = swap.refundDetails;
            if (refund === undefined) {
                return undefined;
            }
            return {
                ...swap,
                type: SwapType.Submarine,
                swapTree: refund.tree,
                assetSend: swap.from,
                assetReceive: swap.to,
                version: OutputType.Taproot,
                blindingKey: refund.blindingKey,
                address: refund.lockupAddress,
                refundPrivateKeyIndex: refund.keyIndex,
                claimPublicKey: refund.serverPublicKey,
                timeoutBlockHeight: refund.timeoutBlockHeight,
            };
        }
        case SwapType.Chain: {
            const refund = swap.refundDetails;
            if (refund === undefined && !isEvmAsset(swap.from)) {
                return undefined;
            }
            const { claimDetails, refundDetails, ...rest } = swap;
            return {
                ...rest,
                type: SwapType.Chain,
                assetSend: swap.from,
                assetReceive: swap.to,
                version: OutputType.Taproot,
                claimPrivateKeyIndex: claimDetails?.keyIndex,
                ...(refund === undefined
                    ? {}
                    : {
                          refundPrivateKeyIndex: refund.keyIndex,
                          lockupDetails: {
                              ...refundDetails,
                              swapTree: refund.tree,
                          } as ChainSwapDetails,
                      }),
            };
        }
        case SwapType.Reverse: {
            const claim = swap.claimDetails;
            if (claim === undefined) {
                return undefined;
            }
            return {
                ...swap,
                type: SwapType.Reverse,
                assetSend: swap.from,
                assetReceive: swap.to,
                version: OutputType.Taproot,
                lockupAddress: claim.lockupAddress,
                timeoutBlockHeight: claim.timeoutBlockHeight,
                claimPrivateKeyIndex: claim.keyIndex,
                sendAmount: claim.amount,
            };
        }
        default:
            return undefined;
    }
};

const RefundRescue = () => {
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation<{
        waitForSwapTimeout?: boolean | undefined;
    }>();

    const { t, notify } = useGlobalContext();
    const {
        swap,
        setSwap,
        failureReason,
        swapStatus,
        swapStatusTransaction,
        refundableUTXOs,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setRefundableUTXOs,
        setShouldIgnoreBackendStatus,
    } = usePayContext();
    const { rescuableSwaps, rescueFile } = useRescueContext();

    const [waitForSwapTimeout, setWaitForTimeout] = createSignal<boolean>(
        location.state?.waitForSwapTimeout ?? false,
    );

    const restoredSwap = () =>
        rescuableSwaps()?.find((swap) => swap.id === params.id);
    const rescuableSwap = () => mapSwap(restoredSwap());

    const [timeoutEta, setTimeoutEta] = createSignal<number>(0);
    const [timeoutBlockHeight, setTimeoutBlockHeight] = createSignal<number>(0);
    const [refundTxId, setRefundTxId] = createSignal<string>("");
    const [loading, setLoading] = createSignal<boolean>(true);

    const refundableLockupTransactionId = () =>
        refundableUTXOs().find(({ id }) => id !== undefined)?.id;

    const lockupTransactionId = () =>
        swap()?.lockupTx ??
        restoredSwap()?.refundDetails?.transaction?.id ??
        swapStatusTransaction()?.id ??
        refundableLockupTransactionId();

    const lockupExplorerId = () => {
        const currentSwap = swap();
        if (currentSwap === null) {
            return undefined;
        }
        if (currentSwap.lockupTx !== undefined) {
            return currentSwap.lockupTx;
        }
        return currentSwap.type === SwapType.Submarine
            ? currentSwap.address
            : currentSwap.type === SwapType.Chain
              ? currentSwap.lockupDetails?.lockupAddress
              : undefined;
    };

    const failureTitle = (): DictKey | undefined => {
        switch (swapStatus()) {
            case swapStatusFailed.InvoiceFailedToPay:
                return "invoice_payment_failure";
            case swapStatusFailed.TransactionFailed:
            case swapStatusFailed.TransactionLockupFailed:
                return "lockup_failed";
            default:
                return undefined;
        }
    };

    createResource(async () => {
        try {
            const mapped = rescuableSwap();
            const restorable = restoredSwap();
            if (mapped !== undefined && restorable !== undefined) {
                const mappedSwap = mapped as SomeSwap;
                setLoading(true);
                try {
                    setSwap(mappedSwap);
                    setSwapStatus(restorable.status);
                    log.debug("selecting swap", mappedSwap);
                    const res = await getSwapStatus(mappedSwap.id);
                    setSwapStatus(res.status);
                    setSwapStatusTransaction(res.transaction ?? {});
                    setFailureReason(res.failureReason ?? "");
                } catch (e) {
                    log.error(
                        `failed to get swap status for swap ${mappedSwap.id}:`,
                        e,
                    );
                }

                // For uncooperative swaps, we don't rely on backend for status updates
                setShouldIgnoreBackendStatus(waitForSwapTimeout());

                const utxos = await getRescuableUTXOs(mappedSwap);

                if (utxos.length === 0) {
                    throw new Error(
                        `failed to get refundable UTXOs for swap ${mappedSwap.id}`,
                    );
                }

                setRefundableUTXOs(utxos);

                if (waitForSwapTimeout()) {
                    try {
                        const blockHeights = await getCurrentBlockHeight([
                            mappedSwap,
                        ]);
                        const currentBlockHeight =
                            blockHeights?.[
                                mappedSwap.assetSend as RefundableAssetType
                            ];
                        if (currentBlockHeight === undefined) {
                            throw new Error(
                                "missing current block height for refund timeout",
                            );
                        }

                        const refundDetails = restorable.refundDetails;
                        if (refundDetails === undefined) {
                            throw new Error(
                                "missing refund details for refund timeout",
                            );
                        }
                        const timeoutBlockHeight =
                            refundDetails.timeoutBlockHeight;

                        const timeoutEta = getTimeoutEta(
                            mappedSwap.assetSend as blockChainsAssets,
                            timeoutBlockHeight,
                            currentBlockHeight,
                        );

                        setTimeoutEta(timeoutEta);
                        setTimeoutBlockHeight(timeoutBlockHeight);
                    } catch (e) {
                        log.error(
                            `failed to get uncooperative timeout ETA for swap ${mappedSwap.id}:`,
                            e,
                        );
                        // if we can't obtain block height data because 3rd party explorer is down, we allow the user to attempt an uncoop refund anyway
                        setWaitForTimeout(false);
                    }
                }
            }
        } catch (e) {
            log.error(e);
            notify("error", t("get_refundable_error"));
        } finally {
            setLoading(false);
        }
    });

    onCleanup(() => {
        log.debug("cleanup RefundRescue");
        setSwap(null);
        setSwapStatus("");
        setFailureReason("");
        setRefundableUTXOs([]);
        setShouldIgnoreBackendStatus(false);
    });

    return (
        <div class="frame" data-status={swapStatus()}>
            <Show
                when={rescuableSwap() !== undefined}
                fallback={<h2>{t("pay_swap_404")}</h2>}>
                <Show when={!loading()} fallback={<LoadingSpinner />}>
                    <SwapHeader
                        id={params.id}
                        status={swapStatus()}
                        assets={
                            swap() !== null
                                ? getSwapIconAssets(swap()!)
                                : undefined
                        }
                    />
                    <Show
                        when={
                            failureTitle() !== undefined ||
                            failureReason() !== ""
                        }>
                        <Show when={failureTitle()}>
                            {(title) => <h2>{t(title())}</h2>}
                        </Show>
                        <Show when={failureReason() !== ""}>
                            <p>
                                {t("failure_reason")}: {failureReason()}
                            </p>
                        </Show>
                        <hr />
                    </Show>

                    <Switch>
                        <Match when={waitForSwapTimeout()}>
                            <RefundEta
                                timeoutEta={timeoutEta}
                                timeoutBlockHeight={timeoutBlockHeight}
                                asset={swap()!.assetSend}
                            />
                            <Show when={lockupExplorerId()}>
                                {(id) => (
                                    <BlockExplorer
                                        asset={swap()!.assetSend}
                                        typeLabel={
                                            swap()!.lockupTx !== undefined
                                                ? "lockup_tx"
                                                : "lockup_address"
                                        }
                                        kind={
                                            swap()!.lockupTx !== undefined
                                                ? BlockExplorerTargetKind.Tx
                                                : BlockExplorerTargetKind.Address
                                        }
                                        id={id()}
                                    />
                                )}
                            </Show>
                            <button
                                class="btn btn-light"
                                data-testid="backBtn"
                                onClick={() => {
                                    navigate(-1);
                                }}>
                                {t("back")}
                            </button>
                        </Match>
                        <Match when={!waitForSwapTimeout()}>
                            <Show when={refundTxId() === ""}>
                                <RefundButton
                                    swap={
                                        swap as Accessor<
                                            SubmarineSwap | ChainSwap
                                        >
                                    }
                                    setRefundTxId={setRefundTxId}
                                    deriveKeyFn={(index: number) => {
                                        const rescue = rescueFile();
                                        if (rescue === undefined) {
                                            throw new Error(
                                                "missing rescue file",
                                            );
                                        }
                                        const derived = deriveKey(
                                            rescue,
                                            index,
                                            swap()!.assetSend as AssetType,
                                        );
                                        if (derived.privateKey === null) {
                                            throw new Error(
                                                "missing private key for derived rescue key",
                                            );
                                        }
                                        return ECPair.fromPrivateKey(
                                            new Uint8Array(derived.privateKey),
                                        );
                                    }}
                                />
                                <Show
                                    when={
                                        swap() !== null && lockupTransactionId()
                                    }>
                                    {(id) => (
                                        <BlockExplorer
                                            typeLabel={"lockup_tx"}
                                            asset={swap()!.assetSend}
                                            kind={BlockExplorerTargetKind.Tx}
                                            id={id()}
                                        />
                                    )}
                                </Show>
                            </Show>
                            <Show when={refundTxId() !== ""}>
                                <p>{t("refunded")}</p>
                                <hr />
                                <BlockExplorer
                                    typeLabel={"refund_tx"}
                                    asset={rescuableSwap()!.assetSend!}
                                    kind={BlockExplorerTargetKind.Tx}
                                    id={refundTxId()}
                                />
                            </Show>
                        </Match>
                    </Switch>
                </Show>
            </Show>
            <SettingsMenu />
        </div>
    );
};

export default RefundRescue;
