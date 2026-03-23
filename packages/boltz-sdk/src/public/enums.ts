/** Direction of a Boltz swap. */
export enum SwapType {
    /** On-chain to Lightning. */
    Submarine = "submarine",
    /** Lightning to on-chain. */
    Reverse = "reverse",
    /** On-chain to on-chain. */
    Chain = "chain",
    /** DEX-routed swap hop. */
    Dex = "dex",
}

/** Amount denomination for display and input. */
export enum Denomination {
    Sat = "sat",
    Btc = "btc",
}

/** Swap side (send vs. receive). */
export enum Side {
    Send = "send",
    Receive = "receive",
}

/** Invoice validation error codes thrown by {@link checkLnurlResponse}. */
export enum InvoiceValidation {
    MinAmount = "minAmount",
    MaxAmount = "maxAmount",
}

/** Fiat currency for price lookups (gas top-up, etc.). */
export enum Currency {
    USD = "USD",
}

/** Classification of chain assets by their underlying technology. */
export const enum AssetKind {
    /** Bitcoin or Liquid UTXO chain. */
    UTXO = "UTXO",
    /** Native EVM chain currency (e.g. RBTC, ETH). */
    EVMNative = "EVM_NATIVE",
    /** ERC-20 token on an EVM chain. */
    ERC20 = "ERC20",
}
