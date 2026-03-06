export enum SwapType {
    Submarine = "submarine",
    Reverse = "reverse",
    Chain = "chain",
    Dex = "dex",
}

export enum Denomination {
    Sat = "sat",
    Btc = "btc",
}

export enum Side {
    Send = "send",
    Receive = "receive",
}

export enum InvoiceValidation {
    MinAmount = "minAmount",
    MaxAmount = "maxAmount",
}

export const enum AssetKind {
    UTXO = "UTXO",
    EVMNative = "EVM_NATIVE",
    ERC20 = "ERC20",
}
