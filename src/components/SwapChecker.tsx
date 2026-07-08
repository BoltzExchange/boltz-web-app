import {
    type SwapUpdate,
    createDefaultStatusSource,
} from "boltz-swaps/statusSource";
import { SwapType } from "boltz-swaps/types";
import log from "loglevel";
import { createEffect, onCleanup, onMount } from "solid-js";
import { createStore } from "solid-js/store";

import { config } from "../config";
import {
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useParentNotifier } from "../utils/notifyParent";
import type { SomeSwap } from "../utils/swapCreator";

export const SwapChecker = () => {
    const {
        swap,
        setSwap,
        claimSwap,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        shouldIgnoreBackendStatus,
    } = usePayContext();
    const { updateSwapStatus, getSwap, getSwaps } = useGlobalContext();
    const { notifyParent } = useParentNotifier();

    const statusSource = createDefaultStatusSource();

    const [pendingSwaps, setPendingSwaps] = createStore<string[]>([]);

    const updatePendingSwaps = (swap: SomeSwap, data: SwapUpdate) => {
        if (![SwapType.Chain, SwapType.Reverse].includes(swap.type)) {
            return;
        }

        if (
            Object.values(swapStatusPending).includes(data.status) &&
            data.status !== swapStatusPending.SwapCreated &&
            !pendingSwaps.includes(swap.id)
        ) {
            setPendingSwaps((pendingSwaps) => [...pendingSwaps, swap.id]);
        }

        if (Object.values(swapStatusFinal).includes(data.status)) {
            setPendingSwaps((pendingSwaps) =>
                pendingSwaps.filter((id: string) => id !== swap.id),
            );
        }
    };

    const prepareSwap = async (
        swapId: string,
        data: SwapUpdate,
    ): Promise<void> => {
        const currentSwap = await getSwap(swapId);
        if (currentSwap === null) {
            log.warn(`prepareSwap: swap ${swapId} not found`);
            return;
        }
        const activeSwap = swap();
        if (activeSwap !== null && activeSwap.id === currentSwap.id) {
            if (!shouldIgnoreBackendStatus()) {
                setSwapStatus(data.status);
                setSwap({ ...activeSwap, status: data.status });
            }
            if (data.transaction) {
                setSwapStatusTransaction(data.transaction);
            }
            if (data.failureReason) {
                setFailureReason(data.failureReason);
            }
        }
        if (data.status) {
            updatePendingSwaps(currentSwap, data);
            await updateSwapStatus(currentSwap.id, data.status);

            if (swapStatusFinal.includes(data.status)) {
                notifyParent({
                    type: "boltz-swap-status",
                    swapId: currentSwap.id,
                    status: data.status,
                });
            }
        }
    };

    // The source emits only on an actual status change, so prepareSwap runs per update
    const handleUpdate = (data: SwapUpdate): void => {
        void prepareSwap(data.id, data).catch((error) =>
            log.error(`prepareSwap failed for swap ${data.id}`, error),
        );
        void navigator.locks
            .request("swapCheckerClaim", () => claimSwap(data.id, data))
            .catch((error) =>
                log.error(`claimSwap failed for swap ${data.id}`, error),
            );
    };

    const subscribeSwap = (id: string): void => {
        statusSource.subscribe(id, handleUpdate);
    };

    onMount(async () => {
        const swapsToCheck = (await getSwaps()).filter((swap) => {
            if (swap.type === SwapType.Commitment) {
                return false;
            }

            if (
                swap.status === undefined ||
                !swapStatusFinal.includes(swap.status)
            ) {
                return true;
            }

            return (
                swap.claimTx === undefined &&
                (swap.status === swapStatusSuccess.InvoiceSettled ||
                    (swap.type === SwapType.Chain &&
                        swap.status === swapStatusSuccess.TransactionClaimed))
            );
        });

        for (const s of swapsToCheck) {
            subscribeSwap(s.id);
        }
    });

    onCleanup(() => {
        statusSource.close?.();
    });

    createEffect(() => {
        const activeSwap = swap();
        if (activeSwap === undefined || activeSwap === null) {
            return;
        }
        if (activeSwap.type === SwapType.Commitment) {
            return;
        }
        subscribeSwap(activeSwap.id);
    });

    window.onbeforeunload = (event: BeforeUnloadEvent) => {
        if (config.preventReloadOnPendingSwaps && pendingSwaps?.length > 0) {
            event.preventDefault();
            return "";
        }
        return undefined;
    };

    return "";
};
