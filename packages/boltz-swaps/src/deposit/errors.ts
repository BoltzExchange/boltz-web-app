// A terminal business failure whose locked commitment should be cooperatively
// refunded rather than retried. Every other error is transient: it propagates
// and the watcher's reconcile loop retries the deposit.
export class DepositRefundableError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "DepositRefundableError";
    }
}
