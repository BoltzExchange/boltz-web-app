import {
    type BridgeTransaction,
    type PendingBridgeSend,
    PendingBridgeSendKind,
    PendingBridgeSendRecoveryStatus,
    bridgeRegistry,
    recoverPendingBridgeSend,
} from "boltz-swaps/bridge";
import log from "loglevel";
import { type Accessor, createEffect, createMemo, onCleanup } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type {
    BridgeDetail,
    PendingBridgeSendCallbacks,
} from "../utils/swapCreator";

const getPendingSendTransaction = (pending: PendingBridgeSend) => {
    switch (pending.kind) {
        case PendingBridgeSendKind.EvmOft:
            return pending.fromNonce;
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

export const useBridgeSendRecovery = (params: {
    swapId: Accessor<string>;
    bridge: Accessor<BridgeDetail>;
    txSent: Accessor<string | undefined>;
}) => {
    const { setSwap, swap } = usePayContext();
    const { getSwap, setSwapStorage } = useGlobalContext();

    const pendingSend = createMemo(() => swap()?.bridge?.pendingSend);

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
    ) => {
        await updateBridge((bridge) => {
            const next: BridgeDetail = {
                ...bridge,
                txHash,
                pendingSend: undefined,
            };
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
        await updateBridge((bridge) => ({ ...bridge, pendingSend: pending }));
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

    const pendingSendCallbacks: PendingBridgeSendCallbacks = {
        persist: (pending) => setPendingSend(pending),
    };

    let recovering = false;
    const recover = async (pending: PendingBridgeSend) => {
        if (recovering) {
            return;
        }
        recovering = true;
        const bridge = params.bridge();
        try {
            const result = await recoverPendingBridgeSend(
                pending,
                pending.kind === PendingBridgeSendKind.EvmOft
                    ? bridgeRegistry
                          .requireDriverForRoute(bridge)
                          .getProvider(bridge.sourceAsset)
                    : undefined,
            );
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

    createEffect(() => {
        const pending = pendingSend();
        if (pending === undefined || params.txSent() !== undefined) {
            return;
        }

        void recover(pending);
        const interval = window.setInterval(() => void recover(pending), 5_000);
        onCleanup(() => window.clearInterval(interval));
    });

    return {
        pendingSend,
        pendingSendCallbacks,
        persistBridgeSend,
        setPendingSend,
    };
};
