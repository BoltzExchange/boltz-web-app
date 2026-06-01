import {
    type BridgeTransaction,
    type PendingBridgeSend,
    PendingBridgeSendKind,
    PendingBridgeSendRecoveryStatus,
    type PendingEvmBridgeSend,
    bridgeRegistry,
    recoverPendingBridgeSend,
} from "boltz-swaps/bridge";
import log from "loglevel";
import {
    type Accessor,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
} from "solid-js";

import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type {
    BridgeDetail,
    PendingBridgeSendCallbacks,
} from "../utils/swapCreator";

type NonEvmPendingBridgeSend = Exclude<PendingBridgeSend, PendingEvmBridgeSend>;

const getPendingSendTransaction = (pending: PendingBridgeSend) => {
    switch (pending.kind) {
        case PendingBridgeSendKind.EvmCctp:
            return pending.fromNonce;
        case PendingBridgeSendKind.EvmOft:
            return pending.fromNonce;
        case PendingBridgeSendKind.SolanaCctp:
            return pending.signature;
        case PendingBridgeSendKind.SolanaOft:
            return pending.signature;
        case PendingBridgeSendKind.TronOft:
            return pending.txHash;
        default: {
            const exhaustiveCheck: never = pending;
            throw new Error(
                `Unsupported pending bridge send: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

const isEvmBridgeSend = (
    pending: PendingBridgeSend | undefined,
): pending is PendingEvmBridgeSend =>
    pending?.kind === PendingBridgeSendKind.EvmOft ||
    pending?.kind === PendingBridgeSendKind.EvmCctp;

export const useBridgeSendRecovery = (params: {
    swapId: Accessor<string>;
    bridge: Accessor<BridgeDetail>;
    txSent: Accessor<string | undefined>;
    evmSendActive?: Accessor<boolean>;
}) => {
    const { setSwap, swap } = usePayContext();
    const { getSwap, setSwapStorage } = useGlobalContext();

    const storedPendingSend = createMemo(() => swap()?.bridge?.pendingSend);
    const pendingSend = createMemo<NonEvmPendingBridgeSend | undefined>(() => {
        const pending = storedPendingSend();
        return isEvmBridgeSend(pending) ? undefined : pending;
    });
    const evmSendCandidate = createMemo<PendingEvmBridgeSend | undefined>(
        () => {
            const stored = storedPendingSend();
            return (
                swap()?.bridge?.evmSendCandidate ??
                (isEvmBridgeSend(stored) ? stored : undefined)
            );
        },
    );
    const [evmSendCandidateRecoveryFailed, setEvmSendCandidateRecoveryFailed] =
        createSignal(false);

    const updateBridge = async (
        update: (bridge: BridgeDetail) => BridgeDetail,
    ) => {
        const currentSwap = await getSwap(params.swapId());
        if (currentSwap === null || currentSwap.bridge === undefined) {
            return;
        }
        currentSwap.bridge = update(currentSwap.bridge);
        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
    };

    const persistBridgeSend = async (
        txHash: string,
        details?: BridgeTransaction["details"],
        sourceAmount?: bigint,
    ) => {
        await updateBridge((bridge) => {
            const next: BridgeDetail = {
                ...bridge,
                txHash,
                pendingSend: undefined,
                evmSendCandidate: undefined,
            };
            if (sourceAmount !== undefined) {
                next.sourceAmount = sourceAmount.toString();
            }
            if (details === undefined) {
                delete next.details;
            } else {
                next.details = details;
            }
            return next;
        });
        log.info("Persisted bridge send tx hash for background worker", {
            swapId: params.swapId(),
            sourceAsset: params.bridge().sourceAsset,
            destinationAsset: params.bridge().destinationAsset,
            txHash,
        });
    };

    const setPendingSend = async (pending: PendingBridgeSend | undefined) => {
        await updateBridge((bridge) => {
            const next = { ...bridge, pendingSend: pending };
            if (pending === undefined) {
                delete next.pendingSend;
            }
            return next;
        });
        if (pending !== undefined) {
            log.info("Persisted pending bridge send for recovery", {
                swapId: params.swapId(),
                sourceAsset: params.bridge().sourceAsset,
                destinationAsset: params.bridge().destinationAsset,
                kind: pending.kind,
                transaction: getPendingSendTransaction(pending),
            });
        }
    };

    const setEvmSendCandidate = async (
        candidate: PendingEvmBridgeSend | undefined,
    ) => {
        await updateBridge((bridge) => {
            const next: BridgeDetail = {
                ...bridge,
                pendingSend: isEvmBridgeSend(bridge.pendingSend)
                    ? undefined
                    : bridge.pendingSend,
                evmSendCandidate: candidate,
            };
            if (next.pendingSend === undefined) {
                delete next.pendingSend;
            }
            if (candidate === undefined) {
                delete next.evmSendCandidate;
            }
            return next;
        });

        setEvmSendCandidateRecoveryFailed(false);
        if (candidate !== undefined) {
            log.info("Persisted EVM bridge send candidate for recovery", {
                swapId: params.swapId(),
                sourceAsset: params.bridge().sourceAsset,
                destinationAsset: params.bridge().destinationAsset,
                kind: candidate.kind,
                fromNonce: candidate.fromNonce,
            });
        }
    };

    const pendingSendCallbacks: PendingBridgeSendCallbacks = {
        persist: (pending) => setPendingSend(pending),
    };

    const getBridgeProvider = () => {
        const bridge = params.bridge();
        return bridgeRegistry
            .requireDriverForRoute(bridge)
            .getProvider(bridge.sourceAsset);
    };

    let recovering = false;
    const recover = async (pending: NonEvmPendingBridgeSend) => {
        if (recovering) {
            return;
        }
        recovering = true;
        try {
            const result = await recoverPendingBridgeSend(pending);
            if (params.txSent() !== undefined) {
                log.info("Skipping stale pending bridge recovery result", {
                    swapId: params.swapId(),
                    kind: pending.kind,
                });
                return;
            }
            switch (result.status) {
                case PendingBridgeSendRecoveryStatus.Recovered:
                    log.info("Recovered pending bridge send", {
                        swapId: params.swapId(),
                        kind: pending.kind,
                        txHash: result.transactionHash,
                    });
                    await persistBridgeSend(result.transactionHash);
                    return;

                case PendingBridgeSendRecoveryStatus.Failed:
                    log.warn("Pending bridge send recovery failed", {
                        swapId: params.swapId(),
                        kind: pending.kind,
                    });
                    await setPendingSend(undefined);
                    return;

                case PendingBridgeSendRecoveryStatus.Pending:
                    return;

                default: {
                    const exhaustive: never = result;
                    throw new Error(
                        `Unsupported bridge recovery status: ${String(exhaustive)}`,
                    );
                }
            }
        } catch (error) {
            log.warn("Failed to recover pending bridge send", {
                swapId: params.swapId(),
                error,
            });
        } finally {
            recovering = false;
        }
    };

    let recoveringEvmCandidate = false;
    const recoverEvmSendCandidate = async (
        candidate: PendingEvmBridgeSend | undefined,
    ) => {
        if (
            candidate === undefined ||
            recoveringEvmCandidate ||
            params.txSent() !== undefined
        ) {
            return;
        }

        recoveringEvmCandidate = true;
        try {
            const result = await recoverPendingBridgeSend(
                candidate,
                getBridgeProvider(),
            );
            if (params.txSent() !== undefined) {
                log.info(
                    "Skipping stale EVM bridge send candidate recovery result",
                    {
                        swapId: params.swapId(),
                        kind: candidate.kind,
                    },
                );
                return;
            }
            switch (result.status) {
                case PendingBridgeSendRecoveryStatus.Recovered:
                    log.info("Recovered EVM bridge send candidate", {
                        swapId: params.swapId(),
                        kind: candidate.kind,
                        txHash: result.transactionHash,
                    });
                    await persistBridgeSend(result.transactionHash);
                    return;

                case PendingBridgeSendRecoveryStatus.Failed:
                    log.warn("EVM bridge send candidate recovery failed", {
                        swapId: params.swapId(),
                        kind: candidate.kind,
                    });
                    setEvmSendCandidateRecoveryFailed(true);
                    return;

                case PendingBridgeSendRecoveryStatus.Pending:
                    setEvmSendCandidateRecoveryFailed(false);
                    return;

                default: {
                    const exhaustive: never = result;
                    throw new Error(
                        `Unsupported bridge recovery status: ${String(exhaustive)}`,
                    );
                }
            }
        } catch (error) {
            setEvmSendCandidateRecoveryFailed(true);
            log.warn("Failed to recover EVM bridge send candidate", {
                swapId: params.swapId(),
                error,
            });
        } finally {
            recoveringEvmCandidate = false;
        }
    };

    const retryEvmSendCandidateRecovery = async () => {
        const candidate = evmSendCandidate();
        if (candidate === undefined) {
            return;
        }

        await setEvmSendCandidate({
            ...candidate,
            createdAt: Date.now(),
        });
    };

    createEffect(() => {
        const pending = pendingSend();
        if (pending === undefined || params.txSent() !== undefined) {
            return;
        }

        void recover(pending);
        const interval = window.setInterval(() => void recover(pending), 5_000);
        onCleanup(() => window.clearInterval(interval));
    });

    createEffect(() => {
        if (params.evmSendActive?.() === true) {
            return;
        }

        const candidate = evmSendCandidate();
        if (
            candidate === undefined ||
            params.txSent() !== undefined ||
            evmSendCandidateRecoveryFailed()
        ) {
            return;
        }

        void recoverEvmSendCandidate(candidate);
        const interval = window.setInterval(
            () => void recoverEvmSendCandidate(candidate),
            5_000,
        );
        onCleanup(() => window.clearInterval(interval));
    });

    return {
        pendingSend,
        pendingSendCallbacks,
        evmSendCandidate,
        evmSendCandidateRecoveryFailed,
        persistBridgeSend,
        recoverEvmSendCandidate: retryEvmSendCandidateRecovery,
        setEvmSendCandidate,
        setPendingSend,
    };
};
