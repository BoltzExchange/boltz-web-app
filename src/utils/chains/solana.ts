import { base58 } from "@scure/base";
import log from "loglevel";

import { config } from "../../config";
import { NetworkTransport } from "../../configs/base";
import lazySolana from "../../lazy/solana";
import { formatError } from "../errors";
import { requireRpcUrls } from "../provider";

export const solanaAddressLength = 32;
export const solanaAtaRentExemptLamports = 2_039_280n;
const solanaGetAccountInfoMethod = "getAccountInfo";
const solanaTokenAccountCreationCache = new Set<string>();
const pendingSolanaTokenAccountChecks = new Map<string, Promise<boolean>>();

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

export const clearSolanaTokenAccountCreationCache = () => {
    solanaTokenAccountCreationCache.clear();
    pendingSolanaTokenAccountChecks.clear();
};

const queryShouldCreateSolanaTokenAccount = async (
    destinationAsset: string,
    recipient: string,
): Promise<boolean> => {
    const destinationConfig = config.assets?.[destinationAsset];
    const mintAddress = destinationConfig.token?.address;
    if (mintAddress === undefined || mintAddress === "") {
        throw new Error(
            `Missing Solana token mint address for asset: ${destinationAsset}`,
        );
    }

    decodeSolanaAddress(recipient);
    const { PublicKey, getAssociatedTokenAddressSync } = await lazySolana.get();

    const recipientPublicKey = new PublicKey(recipient);
    const associatedTokenAddress = getAssociatedTokenAddressSync(
        new PublicKey(mintAddress),
        recipientPublicKey,
        true,
    );

    const rpcUrls = requireRpcUrls(destinationAsset);
    let lastError: unknown;
    for (const rpcUrl of rpcUrls) {
        try {
            const response = await fetch(rpcUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: solanaGetAccountInfoMethod,
                    params: [
                        associatedTokenAddress.toBase58(),
                        {
                            encoding: "base64",
                        },
                    ],
                }),
            });

            if (!response.ok) {
                throw new Error(
                    `Solana RPC ${response.status} ${response.statusText}`,
                );
            }

            const payload: unknown = await response.json();
            const { error, result } = payload as {
                error?: {
                    code?: number;
                    message?: string;
                };
                result?: {
                    value?: Record<string, unknown> | null;
                };
            };
            if (error !== undefined) {
                throw new Error(
                    `Solana RPC error ${error.code ?? "unknown"}: ${error.message ?? "unknown error"}`,
                );
            }
            if (result?.value === undefined) {
                throw new Error("Unexpected Solana account info response");
            }

            return result.value === null;
        } catch (error) {
            lastError = error;
            log.warn("Failed to query Solana associated token account", {
                destinationAsset,
                recipient,
                associatedTokenAddress: associatedTokenAddress.toBase58(),
                rpcUrl,
                error: formatError(error),
            });
        }
    }

    throw new Error(
        `Failed to query Solana associated token account for ${destinationAsset}: ${formatError(lastError)}`,
    );
};

export const shouldCreateSolanaTokenAccount = (
    destinationAsset: string,
    recipient: string | undefined,
): Promise<boolean> => {
    if (recipient === undefined || recipient === "") {
        return Promise.resolve(false);
    }

    const destinationConfig = config.assets?.[destinationAsset];
    if (destinationConfig?.network?.transport !== NetworkTransport.Solana) {
        return Promise.resolve(false);
    }
    if (!isValidSolanaAddress(recipient)) {
        return Promise.resolve(false);
    }

    const cacheKey = `${destinationAsset}:${recipient}`;
    if (solanaTokenAccountCreationCache.has(cacheKey)) {
        return Promise.resolve(true);
    }

    const pendingCheck = pendingSolanaTokenAccountChecks.get(cacheKey);
    if (pendingCheck !== undefined) {
        return pendingCheck;
    }

    const checkPromise = queryShouldCreateSolanaTokenAccount(
        destinationAsset,
        recipient,
    )
        .then((shouldCreate) => {
            if (shouldCreate) {
                solanaTokenAccountCreationCache.add(cacheKey);
            }

            return shouldCreate;
        })
        .finally(() => {
            pendingSolanaTokenAccountChecks.delete(cacheKey);
        });

    pendingSolanaTokenAccountChecks.set(cacheKey, checkPromise);
    return checkPromise;
};
