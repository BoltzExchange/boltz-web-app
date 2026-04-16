import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { base58, hex } from "@scure/base";
import type { Connection } from "@solana/web3.js";
import { solidityPacked } from "ethers";
import log from "loglevel";

import { config } from "../../config";
import { NetworkTransport } from "../../configs/base";
import lazySolana from "../../lazy/solana";
import { formatError } from "../errors";
import { requireRpcUrls } from "../provider";

export const solanaAddressLength = 32;
export const solanaTokenAccountSize = 165;
export const solanaAtaRentExemptLamports = 2_039_280n;
const rpcProbeTimeout = 5_000;

type AccountInfo = Awaited<ReturnType<Connection["getAccountInfo"]>>;

type CacheOptions<T> = {
    shouldCache?: (value: T) => boolean;
};

const connectionPrefix = "connection:";
const rentExemptBalancePrefix = "rent:";
const tokenAccountExistsPrefix = "token-account-exists:";
const accountInfoPrefix = "account-info:";

const createCache = () => {
    const entries = new Map<string, Promise<unknown>>();
    const getCacheKey = (prefix: string, key: string): string =>
        `${prefix}${key}`;

    const set = <T>(
        key: string,
        value: Promise<T>,
        { shouldCache }: CacheOptions<T> = {},
    ): Promise<T> => {
        const cached = value
            .then((resolved) => {
                if (shouldCache !== undefined && !shouldCache(resolved)) {
                    entries.delete(key);
                }

                return resolved;
            })
            .catch((error: unknown) => {
                entries.delete(key);
                throw error;
            });
        entries.set(key, cached as Promise<unknown>);

        return cached;
    };

    return {
        clear: () => {
            entries.clear();
        },
        delete: (key: string) => {
            entries.delete(key);
        },
        getOrCreate: <T>(
            prefix: string,
            key: string,
            create: () => Promise<T>,
            options: CacheOptions<T> = {},
        ): Promise<T> => {
            const cacheKey = getCacheKey(prefix, key);
            const cached = entries.get(cacheKey);
            if (cached !== undefined) {
                return cached as Promise<T>;
            }

            return set(cacheKey, create(), options);
        },
    };
};

const cache = createCache();

export const getCachedSolanaValue = <T>(
    prefix: string,
    key: string,
    create: () => Promise<T>,
    options: CacheOptions<T> = {},
): Promise<T> => cache.getOrCreate(prefix, key, create, options);

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

export const clearSolanaCache = () => {
    cache.clear();
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
                            `Solana RPC request timed out after ${rpcProbeTimeout}ms`,
                        ),
                    );
                }, rpcProbeTimeout);
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
): Promise<Connection> =>
    await cache.getOrCreate(connectionPrefix, rpcUrl, () =>
        createSolanaConnection(rpcUrl),
    );

export const getSolanaConnection = async (
    asset: string,
): Promise<Connection> => {
    const rpcUrls = requireRpcUrls(asset);
    let lastError: unknown;

    for (const rpcUrl of rpcUrls) {
        try {
            return await getOrCreateSolanaConnection(rpcUrl);
        } catch (error) {
            lastError = error;
            log.warn("Failed to create Solana connection", {
                asset,
                rpcUrl,
                error: formatError(lastError),
            });
        }
    }

    throw new Error(
        `Failed to connect to Solana RPC for ${asset}: ${formatError(lastError)}`,
    );
};

export const getSolanaTransactionSender = async (
    asset: string,
    txHash: string,
): Promise<string | undefined> => {
    const connection = await getSolanaConnection(asset);
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
    asset: string,
    ownerAddress: string,
): Promise<bigint> => {
    const [{ web3 }, connection] = await Promise.all([
        lazySolana.get(),
        getSolanaConnection(asset),
    ]);

    return BigInt(
        await connection.getBalance(new web3.PublicKey(ownerAddress)),
    );
};

export const getSolanaRentExemptMinimumBalance = async (
    asset: string,
    accountSize: number,
): Promise<bigint> =>
    await cache.getOrCreate(
        rentExemptBalancePrefix,
        accountSize.toString(),
        async () => {
            const connection = await getSolanaConnection(asset);
            return BigInt(
                await connection.getMinimumBalanceForRentExemption(
                    accountSize,
                    "confirmed",
                ),
            );
        },
    );

export const getSolanaAccountInfo = async (
    asset: string,
    accountAddress: string,
): Promise<AccountInfo> => {
    const { web3 } = await lazySolana.get();
    const publicKey = new web3.PublicKey(accountAddress);
    const normalizedAddress = publicKey.toBase58();

    return await cache.getOrCreate(
        accountInfoPrefix,
        normalizedAddress,
        async () => {
            const connection = await getSolanaConnection(asset);
            return await connection.getAccountInfo(publicKey, "confirmed");
        },
        {
            shouldCache: (accountInfo) => accountInfo !== null,
        },
    );
};

const queryShouldCreateSolanaTokenAccount = async (
    destinationAsset: string,
    recipient: string,
    mintAddress: string,
): Promise<boolean> => {
    decodeSolanaAddress(recipient);
    const { web3, splToken } = await lazySolana.get();

    const recipientPublicKey = new web3.PublicKey(recipient);
    const associatedTokenAddress = splToken
        .getAssociatedTokenAddressSync(
            new web3.PublicKey(mintAddress),
            recipientPublicKey,
            true,
        )
        .toBase58();

    return (
        (await getSolanaAccountInfo(
            destinationAsset,
            associatedTokenAddress,
        )) === null
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

    const mintAddress = destinationConfig.token?.address;
    if (mintAddress === undefined || mintAddress === "") {
        return Promise.reject(
            new Error(
                `Missing Solana token mint address for asset: ${destinationAsset}`,
            ),
        );
    }

    return cache
        .getOrCreate(
            tokenAccountExistsPrefix,
            `${mintAddress}:${recipient}`,
            async () => {
                return !(await queryShouldCreateSolanaTokenAccount(
                    destinationAsset,
                    recipient,
                    mintAddress,
                ));
            },
            {
                shouldCache: (exists) => exists,
            },
        )
        .then((exists) => !exists);
};
