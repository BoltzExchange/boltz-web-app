import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { base58, hex } from "@scure/base";
import type { Connection } from "@solana/web3.js";
import { solidityPacked } from "ethers";
import log from "loglevel";

import { config } from "../../config";
import { NetworkTransport } from "../../configs/base";
import lazySolana from "../../lazy/solana";
import { getCachedValue } from "../cache";
import { formatError } from "../errors";
import { requireRpcUrls } from "../provider";

export const solanaAddressLength = 32;
export const solanaTokenAccountSize = 165;
export const solanaAtaRentExemptLamports = 2_039_280n;
const rpcProbeTimeout = 5_000;

type AccountInfo = Awaited<ReturnType<Connection["getAccountInfo"]>>;
const cachePrefix = "solana:";
const connectionPrefix = `${cachePrefix}connection:`;
const rentExemptBalancePrefix = `${cachePrefix}rent:`;
const tokenAccountExistsPrefix = `${cachePrefix}token-account-exists:`;
const accountInfoPrefix = `${cachePrefix}account-info:`;

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
    await getCachedValue(connectionPrefix, rpcUrl, () =>
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
    await getCachedValue(
        rentExemptBalancePrefix,
        `${asset}:${accountSize}`,
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
    connection?: Connection,
): Promise<AccountInfo> => {
    const { web3 } = await lazySolana.get();
    const publicKey = new web3.PublicKey(accountAddress);
    const normalizedAddress = publicKey.toBase58();

    if (connection === undefined) {
        connection = await getSolanaConnection(asset);
    }

    return await getCachedValue(
        accountInfoPrefix,
        `${asset}:${normalizedAddress}`,
        async () => await connection.getAccountInfo(publicKey, "confirmed"),
        {
            shouldRetain: (accountInfo) => accountInfo !== null,
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

    return getCachedValue(
        tokenAccountExistsPrefix,
        `${destinationAsset}:${mintAddress}:${recipient}`,
        async () =>
            await queryShouldCreateSolanaTokenAccount(
                destinationAsset,
                recipient,
                mintAddress,
            ),
        {
            shouldRetain: (shouldCreate) => !shouldCreate,
        },
    );
};
