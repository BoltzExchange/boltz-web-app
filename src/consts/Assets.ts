export const LN = "LN";
export const BTC = "BTC";
export const LBTC = "L-BTC";
export const RBTC = "RBTC";

export type AssetType = typeof LN | typeof BTC | typeof LBTC | typeof RBTC;
export type RefundableAssetType = typeof BTC | typeof LBTC;

export const assets = [LN, BTC, LBTC, RBTC];

// RBTC is not refundable because its keys come from the user's wallet
export const refundableAssets = [BTC, LBTC];
