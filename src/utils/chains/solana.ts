import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { base58, hex } from "@scure/base";
import type { Connection } from "@solana/web3.js";
import { solidityPacked } from "ethers";
import log from "loglevel";

import { config } from "../../config";
import { NetworkTransport } from "../../configs/base";
import lazySolana from "../../lazy/solana";
import { formatError } from "../errors";
import { constructRequestOptions } from "../helper";
import { requireRpcUrls } from "../provider";

export const solanaAddressLength = 32;
export const solanaTokenAccountSize = 165;
export const solanaAtaRentExemptLamports = 2_039_280n;
const solanaGetAccountInfoMethod = "getAccountInfo";
const solanaRpcProbeTimeout = 5_000;
const solanaTokenAccountExistsCache = new Set<string>();
const solanaConnectionCache = new Map<string, Promise<Connection>>();
const solanaRentExemptBalanceCache = new Map<string, Promise<bigint>>();

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

export const encodeSolanaRecipient = (recipient: string): string =>
    `0x${hex.encode(decodeSolanaAddress(recipient))}`;

export const encodeSolanaAtaCreationOption = (): string =>
    solidityPacked(["uint128", "uint128"], [0n, solanaAtaRentExemptLamports]);

export const clearSolanaTokenAccountCreationCache = () => {
    solanaTokenAccountExistsCache.clear();
};

export const clearSolanaConnectionCache = () => {
    solanaConnectionCache.clear();
};

export const clearSolanaRentExemptBalanceCache = () => {
    solanaRentExemptBalanceCache.clear();
};

export const getConnectedSolanaWalletAddress = async (
    walletProvider: SolanaWalletProvider,
): Promise<string | undefined> =>
    walletProvider.publicKey?.toBase58() ??
    (await walletProvider.getAccounts())[0]?.address;

export const getSolanaAssociatedTokenAddress = async (
    mintAddress: string,
    ownerAddress: string,
): Promise<string> => {
    const { web3, splToken } = await lazySolana.get();

    return splToken
        .getAssociatedTokenAddressSync(
            new web3.PublicKey(mintAddress),
            new web3.PublicKey(ownerAddress),
            false,
            splToken.TOKEN_PROGRAM_ID,
        )
        .toBase58();
};

const createSolanaConnection = async (rpcUrl: string): Promise<Connection> => {
    const { web3 } = await lazySolana.get();
    const connection = new web3.Connection(rpcUrl, "confirmed");

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
        await Promise.race([
            connection.getVersion(),
            new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(
                        new Error(
                            `Solana RPC request timed out after ${solanaRpcProbeTimeout}ms`,
                        ),
                    );
                }, solanaRpcProbeTimeout);
            }),
        ]);
    } finally {
        if (timeoutHandle !== undefined) {
            clearTimeout(timeoutHandle);
        }
    }

    return connection;
};

const getOrCreateSolanaConnection = async (
    rpcUrl: string,
): Promise<Connection> => {
    const cached = solanaConnectionCache.get(rpcUrl);
    if (cached !== undefined) {
        return await cached;
    }

    const created = createSolanaConnection(rpcUrl).catch((error: unknown) => {
        solanaConnectionCache.delete(rpcUrl);
        throw error;
    });
    solanaConnectionCache.set(rpcUrl, created);

    return await created;
};

export const getSolanaConnection = async (
    sourceAsset: string,
): Promise<Connection> => {
    const rpcUrls = requireRpcUrls(sourceAsset);
    let lastError: unknown;

    for (const rpcUrl of rpcUrls) {
        try {
            return await getOrCreateSolanaConnection(rpcUrl);
        } catch (error) {
            lastError = error;
            log.warn("Failed to create Solana connection", {
                sourceAsset,
                rpcUrl,
                error: formatError(lastError),
            });
        }
    }

    throw new Error(
        `Failed to connect to Solana RPC for ${sourceAsset}: ${formatError(lastError)}`,
    );
};

export const getSolanaTransactionSender = async (
    sourceAsset: string,
    txHash: string,
): Promise<string | undefined> => {
    const connection = await getSolanaConnection(sourceAsset);
    const transaction = await connection.getParsedTransaction(txHash, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
    });
    const signerPubkey = transaction?.transaction.message.accountKeys.find(
        (account) => account.signer,
    )?.pubkey;

    return typeof signerPubkey === "string"
        ? signerPubkey
        : signerPubkey?.toBase58();
};

export const getSolanaNativeBalance = async (
    sourceAsset: string,
    ownerAddress: string,
): Promise<bigint> => {
    const [{ web3 }, connection] = await Promise.all([
        lazySolana.get(),
        getSolanaConnection(sourceAsset),
    ]);

    return BigInt(
        await connection.getBalance(new web3.PublicKey(ownerAddress)),
    );
};

export const getSolanaRentExemptMinimumBalance = async (
    sourceAsset: string,
    accountSize: number,
): Promise<bigint> => {
    const cacheKey = `${sourceAsset}:${accountSize}`;
    const cached = solanaRentExemptBalanceCache.get(cacheKey);
    if (cached !== undefined) {
        return await cached;
    }

    const created = getSolanaConnection(sourceAsset)
        .then(async (connection) =>
            BigInt(
                await connection.getMinimumBalanceForRentExemption(
                    accountSize,
                    "confirmed",
                ),
            ),
        )
        .catch((error: unknown) => {
            solanaRentExemptBalanceCache.delete(cacheKey);
            throw error;
        });
    solanaRentExemptBalanceCache.set(cacheKey, created);

    return await created;
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
    const { web3, splToken } = await lazySolana.get();

    const recipientPublicKey = new web3.PublicKey(recipient);
    const associatedTokenAddress = splToken.getAssociatedTokenAddressSync(
        new web3.PublicKey(mintAddress),
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
