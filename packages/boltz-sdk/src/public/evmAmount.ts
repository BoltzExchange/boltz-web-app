import { AssetKind } from "./enums";
import { getKindForAsset, getTokenDecimals } from "./assets";

// Satoshis are 10 ** 8 and Wei 10 ** 18 -> sats to wei 10 ** 10
const weiFactor = BigInt(10 ** 10);

export const satoshiToWei = (satoshis: number): bigint =>
    BigInt(satoshis) * weiFactor;

export const weiToSatoshi = (wei: bigint): bigint => wei / weiFactor;

const satsToToken = (sats: number, decimals: number): bigint => {
    const diff = decimals - 8;
    if (diff >= 0) {
        return BigInt(sats) * BigInt(10 ** diff);
    }
    return BigInt(sats) / BigInt(10 ** -diff);
};

const tokenToSats = (amount: bigint, decimals: number): bigint => {
    const diff = decimals - 8;
    if (diff >= 0) {
        return amount / BigInt(10 ** diff);
    }
    return amount * BigInt(10 ** -diff);
};

/**
 * Convert satoshis to the appropriate amount for an EVM asset.
 * - For EVM native assets (e.g. RBTC): converts to wei (18 decimals).
 * - For ERC-20 tokens: converts based on the token's configured decimals.
 */
export const satsToAssetAmount = (sats: number, asset: string): bigint => {
    const kind = getKindForAsset(asset);

    if (kind === AssetKind.EVMNative) {
        return satoshiToWei(sats);
    }

    return satsToToken(sats, getTokenDecimals(asset));
};

/**
 * Convert an EVM asset amount back to satoshis.
 */
export const assetAmountToSats = (amount: bigint, asset: string): bigint => {
    const kind = getKindForAsset(asset);

    if (kind === AssetKind.EVMNative) {
        return weiToSatoshi(amount);
    }

    return tokenToSats(amount, getTokenDecimals(asset));
};
