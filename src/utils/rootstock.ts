import { AssetKind, getKindForAsset, getTokenDecimals } from "../consts/Assets";

// Satoshis are 10 ** 8 and Wei 10 ** 18 -> sats to wei 10 ** 10
const weiFactor = BigInt(10 ** 10);

export const slippageLimit = 0.01;

export const satoshiToWei = (satoshis: number) => BigInt(satoshis) * weiFactor;

export const weiToSatoshi = (wei: bigint) => BigInt(wei) / weiFactor;

export const prefix0x = (val: string) => `0x${val}`;

const satsToToken = (sats: number, decimals: number) => {
    const diff = decimals - 8;
    if (diff >= 0) {
        return BigInt(sats) * BigInt(10 ** diff);
    }
    return BigInt(sats) / BigInt(10 ** -diff);
};

const tokenToSats = (amount: bigint, decimals: number) => {
    const diff = decimals - 8;
    if (diff >= 0) {
        return amount / BigInt(10 ** diff);
    }
    return amount * BigInt(10 ** -diff);
};

/**
 * Converts satoshis to the appropriate amount for an EVM asset.
 * - For EVMNative assets (like RBTC): converts to wei (18 decimals)
 * - For ERC20 tokens: converts based on the token's configured decimals
 */
export const satsToAssetAmount = (sats: number, asset: string): bigint => {
    const kind = getKindForAsset(asset);

    if (kind === AssetKind.EVMNative) {
        return satoshiToWei(sats);
    }

    return satsToToken(sats, getTokenDecimals(asset));
};

/**
 * Converts an EVM asset amount back to satoshis.
 * - For EVMNative assets (like RBTC): converts from wei (18 decimals)
 * - For ERC20 tokens: converts based on the token's configured decimals
 */
export const assetAmountToSats = (amount: bigint, asset: string): bigint => {
    const kind = getKindForAsset(asset);

    if (kind === AssetKind.EVMNative) {
        return weiToSatoshi(amount);
    }

    return tokenToSats(amount, getTokenDecimals(asset));
};
