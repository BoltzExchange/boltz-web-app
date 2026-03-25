import { base58 } from "@scure/base";

export const solanaAddressLength = 32;

export const decodeSolanaAddress = (address: string): Uint8Array => {
    const decoded = base58.decode(address);
    if (decoded.length !== solanaAddressLength) {
        throw new Error(`Invalid Solana recipient address: ${address}`);
    }

    return decoded;
};

export const isValidSolanaAddress = (address: string): boolean => {
    try {
        decodeSolanaAddress(address);
        return true;
    } catch {
        return false;
    }
};
