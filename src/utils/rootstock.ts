// Satoshis are 10 ** 8 and Wei 10 ** 18 -> sats to wei 10 ** 10
const weiFactor = BigInt(10 ** 10);

export const satoshiToWei = (satoshis: number) => BigInt(satoshis) * weiFactor;

export const weiToSatoshi = (wei: bigint) => BigInt(wei) / weiFactor;

export const prefix0x = (val: string) => `0x${val}`;
