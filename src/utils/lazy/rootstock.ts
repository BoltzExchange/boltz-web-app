// Satoshis are 10 ** 8 and Wei 10 ** 18 -> sats to wei 10 ** 10
import { abi } from "boltz-core/out/EtherSwap.sol/EtherSwap.json";

export const satoshiToWei = (satoshis: number) =>
    BigInt(satoshis) * BigInt(10 ** 10);

export const prefix0x = (val: string) => `0x${val}`;

export const EtherSwapAbi = abi;
