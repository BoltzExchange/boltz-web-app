import { sha256 } from "@noble/hashes/sha2.js";
import { base58 } from "@scure/base";

export const tronAddressLength = 25;
const tronPayloadLength = 21;
const tronPrefix = 0x41;

export const decodeTronBase58Address = (address: string): Uint8Array => {
    const decoded = base58.decode(address);
    if (decoded.length !== tronAddressLength) {
        throw new Error(`Invalid Tron recipient length: ${address}`);
    }

    const payload = decoded.subarray(0, tronPayloadLength);
    const checksum = decoded.subarray(tronPayloadLength);
    const expectedChecksum = sha256(sha256(payload)).slice(0, 4);
    if (!checksum.every((byte, index) => byte === expectedChecksum[index])) {
        throw new Error(`Invalid Tron recipient checksum: ${address}`);
    }

    if (payload[0] !== tronPrefix) {
        throw new Error(`Invalid Tron recipient prefix: ${address}`);
    }

    return payload.subarray(1);
};

export const isValidTronAddress = (address: string): boolean => {
    try {
        decodeTronBase58Address(address);
        return true;
    } catch {
        return false;
    }
};
