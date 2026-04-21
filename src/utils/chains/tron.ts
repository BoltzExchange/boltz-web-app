import { sha256 } from "@noble/hashes/sha2.js";
import { base58, hex } from "@scure/base";
import log from "loglevel";
import type { TronWeb as TronWebClient } from "tronweb";

import lazyTron from "../../lazy/tron";
import { getCachedValue } from "../cache";
import { formatError } from "../errors";
import { requireRpcUrls } from "../provider";

export const tronAddressLength = 25;
const tronPayloadLength = 21;
const tronPrefix = 0x41;
const tronRpcProbeTimeout = 5_000;
const tronSuccessReceiptResult = "SUCCESS";
const tronClientPrefix = "tron:client:";

export type TronTransaction = Awaited<
    ReturnType<TronWebClient["trx"]["getTransaction"]>
>;

export type TronTransactionInfo = Awaited<
    ReturnType<TronWebClient["trx"]["getTransactionInfo"]>
>;

export type TronSignedTransaction = Parameters<
    TronWebClient["trx"]["sendRawTransaction"]
>[0];

const isEmptyTronResponse = (value: unknown): boolean =>
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).length === 0;

const normalizeTronHexAddress = (address: string): string => {
    const normalized = address.toLowerCase().replace(/^0x/, "");

    if (normalized.length === 40) {
        return `${tronPrefix.toString(16)}${normalized}`;
    }

    if (normalized.length !== 42 || !normalized.startsWith("41")) {
        throw new Error(`Invalid Tron hex address: ${address}`);
    }

    return normalized;
};

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

export const encodeTronBase58Address = (address: Uint8Array): string => {
    if (address.length !== 20) {
        throw new Error(`Invalid Tron address length: ${address.length}`);
    }

    const payload = new Uint8Array(tronPayloadLength);
    payload[0] = tronPrefix;
    payload.set(address, 1);

    const checksum = sha256(sha256(payload)).slice(0, 4);
    const encoded = new Uint8Array(tronAddressLength);
    encoded.set(payload);
    encoded.set(checksum, tronPayloadLength);

    return base58.encode(encoded);
};

export const tronHexToBase58Address = (address: string): string =>
    encodeTronBase58Address(
        hex.decode(normalizeTronHexAddress(address).slice(2)),
    );

export const tronBase58ToHexAddress = (address: string): `0x${string}` =>
    `0x${hex.encode(decodeTronBase58Address(address))}`;

export const isValidTronAddress = (address: string): boolean => {
    try {
        decodeTronBase58Address(address);
        return true;
    } catch {
        return false;
    }
};

const createTronClient = async (rpcUrl: string): Promise<TronWebClient> => {
    const { TronWeb } = await lazyTron.get();
    const client = new TronWeb({
        fullHost: rpcUrl,
    }) as TronWebClient;

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
        await Promise.race([
            client.trx.getCurrentBlock(),
            new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(
                        new Error(
                            `Tron RPC request timed out after ${tronRpcProbeTimeout}ms`,
                        ),
                    );
                }, tronRpcProbeTimeout);
            }),
        ]);
    } finally {
        if (timeoutHandle !== undefined) {
            clearTimeout(timeoutHandle);
        }
    }

    return client;
};

const getOrCreateTronClient = async (rpcUrl: string): Promise<TronWebClient> =>
    await getCachedValue(tronClientPrefix, rpcUrl, () =>
        createTronClient(rpcUrl),
    );

export const getTronWeb = async (
    sourceAsset: string,
): Promise<TronWebClient> => {
    const rpcUrls = requireRpcUrls(sourceAsset);
    let lastError: unknown;

    for (const rpcUrl of rpcUrls) {
        try {
            return await getOrCreateTronClient(rpcUrl);
        } catch (error) {
            lastError = error;
            log.warn("Failed to create Tron client", {
                sourceAsset,
                rpcUrl,
                error: formatError(lastError),
            });
        }
    }

    throw new Error(
        `Failed to connect to Tron RPC for ${sourceAsset}: ${formatError(lastError)}`,
    );
};

export const getTronNativeBalance = async (
    sourceAsset: string,
    ownerAddress: string,
): Promise<bigint> =>
    BigInt(await (await getTronWeb(sourceAsset)).trx.getBalance(ownerAddress));

export const getTronTransaction = async (
    sourceAsset: string,
    txHash: string,
): Promise<TronTransaction | undefined> => {
    const transaction = await (
        await getTronWeb(sourceAsset)
    ).trx.getTransaction(txHash);

    return isEmptyTronResponse(transaction) ? undefined : transaction;
};

export const getTronTransactionInfo = async (
    sourceAsset: string,
    txHash: string,
): Promise<TronTransactionInfo | undefined> => {
    const transactionInfo = await (
        await getTronWeb(sourceAsset)
    ).trx.getTransactionInfo(txHash);

    return isEmptyTronResponse(transactionInfo) ? undefined : transactionInfo;
};

export const isFailedTronTransaction = (
    transactionInfo: Pick<TronTransactionInfo, "result" | "receipt">,
): boolean =>
    transactionInfo.result === "FAILED" ||
    transactionInfo.receipt?.result !== tronSuccessReceiptResult;

export const getTronTransactionSender = async (
    sourceAsset: string,
    txHash: string,
): Promise<string | undefined> => {
    const transaction = await getTronTransaction(sourceAsset, txHash);
    const ownerAddress = (
        transaction?.raw_data?.contract?.[0]?.parameter?.value as
            | {
                  owner_address?: string;
              }
            | undefined
    )?.owner_address;

    return ownerAddress === undefined
        ? undefined
        : tronHexToBase58Address(ownerAddress);
};
