// A terminal, business-rule failure of a deposit whose locked commitment should
// be cooperatively refunded rather than retried: the out-swap was rejected for
// pair/limit/amount reasons, or the swap reached a failure status. The engine
// catches this in `advanceDeposit` and routes the record to Refunding (or Failed
// when nothing was locked yet). Every OTHER error is treated as transient and
// propagates, so the watcher's reconcile loop retries the deposit.
export class DepositRefundableError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "DepositRefundableError";
    }
}
