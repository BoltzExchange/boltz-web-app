export type SwapUpdate = {
    id: string;
    status: string;
    failureReason?: string;
    zeroConfRejected?: boolean;
    transaction?: { id: string; hex?: string };
};

export type StatusUpdateHandler = (update: SwapUpdate) => void;
export type StatusErrorHandler = (error: unknown, id: string) => void;
export type Unsubscribe = () => void;

// Pluggable source of swap-status updates; inject via BoltzSwapsConfig.
export interface StatusSource {
    // Delivers the current status as soon as known; unsubscribe is idempotent.
    subscribe(
        id: string,
        onUpdate: StatusUpdateHandler,
        onError?: StatusErrorHandler,
    ): Unsubscribe;

    close?(): void;
}
