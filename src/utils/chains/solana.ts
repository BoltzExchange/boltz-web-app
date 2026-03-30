import { base58 } from "@scure/base";
import log from "loglevel";

import { config } from "../../config";
import { NetworkTransport } from "../../configs/base";
import lazySolana from "../../lazy/solana";
import { formatError } from "../errors";
import { constructRequestOptions } from "../helper";
import { requireRpcUrls } from "../provider";

export const solanaAddressLength = 32;
export const solanaAtaRentExemptLamports = 2_039_280n;
const solanaGetAccountInfoMethod = "getAccountInfo";
const solanaRpcProbeTimeout = 5_000;
const solanaTokenAccountExistsCache = new Set<string>();

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
    solanaTokenAccountExistsCache.clear();
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
        const { opts, requestTimeout } = constructRequestOptions(
            {
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
            },
            solanaRpcProbeTimeout,
        );

        try {
            const response = await fetch(rpcUrl, opts);

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
            const isAbortError =
                (error instanceof DOMException &&
                    error.name === "AbortError") ||
                opts.signal?.aborted === true;
            lastError = isAbortError
                ? new Error(
                      `Solana RPC request timed out after ${solanaRpcProbeTimeout}ms`,
                  )
                : error;
            log.warn("Failed to query Solana associated token account", {
                destinationAsset,
                recipient,
                associatedTokenAddress: associatedTokenAddress.toBase58(),
                rpcUrl,
                error: formatError(lastError),
            });
        } finally {
            clearTimeout(requestTimeout);
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
    if (solanaTokenAccountExistsCache.has(cacheKey)) {
        return Promise.resolve(false);
    }

    return queryShouldCreateSolanaTokenAccount(
        destinationAsset,
        recipient,
    ).then((shouldCreate) => {
        if (!shouldCreate) {
            solanaTokenAccountExistsCache.add(cacheKey);
        }

        return shouldCreate;
    });
};
