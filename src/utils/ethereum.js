// Satoshis are 10 ** 8 and Wei 10 ** 18 -> sats to wei 10 ** 10
export const satoshiToWei = (satoshis) => BigInt(satoshis) * 10n ** 10n;

export const prefix0x = (val) => `0x${val}`;
