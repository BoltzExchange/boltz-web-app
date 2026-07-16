export enum Denomination {
    Sat = "sat",
    Btc = "btc",
}

export enum Side {
    Send = "send",
    Receive = "receive",
}

export enum UrlParam {
    Destination = "destination",
    SendAsset = "sendAsset",
    ReceiveAsset = "receiveAsset",
    SendAmount = "sendAmount",
    ReceiveAmount = "receiveAmount",
    Lang = "lang",
    Ref = "ref",
    FiatCurrency = "fiatCurrency",
    Embedded = "embedded",
    Theme = "theme",
    LockOutput = "lockOutput",
    Backup = "backup",
    ParentOrigin = "parentOrigin",
}

export enum AssetSelection {
    Asset = "asset",
    AssetNetwork = "assetNetwork",
}

export enum InvoiceValidation {
    MinAmount = "minAmount",
    MaxAmount = "maxAmount",
    ExactAmount = "exactAmount",
}

export enum Currency {
    USD = "USD",
    EUR = "EUR",
}
