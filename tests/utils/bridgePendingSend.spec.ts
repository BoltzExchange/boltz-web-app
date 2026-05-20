import {
    PendingBridgeSendKind,
    PendingBridgeSendRecoveryStatus,
    type PendingEvmOftBridgeSend,
    type PendingSolanaOftBridgeSend,
    type PendingTronOftBridgeSend,
    recoverPendingEvmOftSend,
    recoverPendingSolanaOftSend,
    recoverPendingTronOftSend,
} from "boltz-swaps/bridge";
import { oftAbi } from "boltz-swaps/oft";
import { getSolanaConnection } from "boltz-swaps/solana";
import type * as TronChain from "boltz-swaps/tron";
import { getTronTransaction, getTronTransactionInfo } from "boltz-swaps/tron";
import {
    type Hex,
    type PublicClient,
    encodeAbiParameters,
    encodeEventTopics,
} from "viem";
import { describe, expect, test, vi } from "vitest";

vi.mock("boltz-swaps/solana", () => ({
    getSolanaConnection: vi.fn(),
}));

vi.mock("boltz-swaps/tron", async (importOriginal) => ({
    ...(await importOriginal<typeof TronChain>()),
    getTronTransaction: vi.fn(),
    getTronTransactionInfo: vi.fn(),
}));

const sender = "0x1000000000000000000000000000000000000000";
const target = "0x2000000000000000000000000000000000000000";
const oftContractAddress = "0x3000000000000000000000000000000000000000";
const calldata = "0xabcdef";
const transactionHash =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
const solanaSignature =
    "4Z5XjC7hYw5Z5TFySTbRHzM2cTRkuzMCVYDn6H3CUf1W9EN2TRdLhXjFiKDLxx8FEh3zKfJQyTjU3KFiKxVYjR7m";
const tronTransactionHash =
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const pendingSend: PendingEvmOftBridgeSend = {
    kind: PendingBridgeSendKind.EvmOft,
    createdAt: 1,
    sender,
    fromNonce: 7,
    fromBlock: 100,
    oftContractAddress,
    transactionTo: target,
    calldata,
};

const createOftSentLog = (
    overrides: Partial<{
        transactionHash: string;
        address: string;
        fromAddress: string;
    }> = {},
) => ({
    address: overrides.address ?? oftContractAddress,
    transactionHash: overrides.transactionHash ?? transactionHash,
    data: encodeAbiParameters(
        [{ type: "uint32" }, { type: "uint256" }, { type: "uint256" }],
        [30184, 1000n, 990n],
    ),
    topics: encodeEventTopics({
        abi: oftAbi,
        eventName: "OFTSent",
        args: {
            guid: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            fromAddress: (overrides.fromAddress ?? sender) as Hex,
        },
    }),
    blockNumber: 101,
    index: 0,
});

const createProvider = ({
    logs = [createOftSentLog()],
    transaction = {
        nonce: 7,
        from: sender,
        to: target,
        value: 123n,
        input: calldata,
    },
    receipt = {
        status: "success",
        logs: [createOftSentLog()],
    },
    latestNonce = 7,
    pendingNonce = latestNonce,
}: {
    logs?: unknown[];
    transaction?: unknown;
    receipt?: unknown;
    latestNonce?: number;
    pendingNonce?: number;
} = {}) =>
    ({
        getLogs: vi.fn().mockResolvedValue(logs),
        getTransaction: vi.fn().mockResolvedValue(transaction),
        getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
        getTransactionCount: vi
            .fn()
            .mockImplementation(({ blockTag }: { blockTag: string }) =>
                Promise.resolve(
                    blockTag === "pending" ? pendingNonce : latestNonce,
                ),
            ),
    }) as unknown as PublicClient;

describe("recoverPendingEvmOftSend", () => {
    test("recovers a tx matching sender calldata and OFTSent", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider(),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash,
        });
    });

    test("filters OFTSent logs by indexed sender", async () => {
        const provider = createProvider();

        await recoverPendingEvmOftSend(pendingSend, provider);

        expect(provider.getLogs).toHaveBeenCalledWith(
            expect.objectContaining({
                args: { fromAddress: sender },
            }),
        );
    });

    test("recovers when duplicate OFTSent logs point to the same tx", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider({
                logs: [createOftSentLog(), createOftSentLog()],
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash,
        });
    });

    test("recovers when the wallet broadcasts with a higher nonce", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider({
                transaction: {
                    nonce: 8,
                    from: sender,
                    to: target,
                    value: 123n,
                    input: calldata,
                },
                latestNonce: 8,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash,
        });
    });

    test("fails when calldata differs and the nonce is mined", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider({
                transaction: {
                    nonce: 7,
                    from: sender,
                    to: target,
                    value: 123n,
                    input: "0x123456",
                },
                latestNonce: 8,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
    });

    test("keeps pending while the nonce has not been mined", async () => {
        const result = await recoverPendingEvmOftSend(
            { ...pendingSend, createdAt: Date.now() },
            createProvider({ logs: [], latestNonce: 7 }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
    });

    test("keeps pending while the nonce is still in the mempool", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider({
                logs: [],
                latestNonce: 7,
                pendingNonce: 8,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
    });

    test("fails when the nonce never advances before expiry", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider({
                logs: [],
                latestNonce: 7,
                pendingNonce: 7,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
    });

    test("fails when the nonce is mined without a matching OFTSent", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider({ logs: [], latestNonce: 8 }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
    });

    test("keeps checking briefly after nonce advances to allow log indexing", async () => {
        const result = await recoverPendingEvmOftSend(
            { ...pendingSend, createdAt: Date.now() },
            createProvider({ logs: [], latestNonce: 8 }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
    });
});

const mockedGetSolanaConnection = vi.mocked(getSolanaConnection);
const mockedGetTronTransaction = vi.mocked(getTronTransaction);
const mockedGetTronTransactionInfo = vi.mocked(getTronTransactionInfo);

const solanaPendingSend: PendingSolanaOftBridgeSend = {
    kind: PendingBridgeSendKind.SolanaOft,
    sourceAsset: "USDT0-SOL",
    lastValidBlockHeight: 100,
    signature: solanaSignature,
};

const createSolanaConnection = ({
    status = null,
    blockHeight = 50,
}: {
    status?: unknown;
    blockHeight?: number;
} = {}) => ({
    getSignatureStatuses: vi.fn().mockResolvedValue({ value: [status] }),
    getBlockHeight: vi.fn().mockResolvedValue(blockHeight),
    sendRawTransaction: vi.fn(),
});

describe("recoverPendingSolanaOftSend", () => {
    test("recovers a signed tx already found on-chain", async () => {
        const connection = createSolanaConnection({
            status: { err: null },
        });
        mockedGetSolanaConnection.mockResolvedValue(connection as never);

        const result = await recoverPendingSolanaOftSend(solanaPendingSend);

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: solanaSignature,
        });
        expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });

    test("keeps a signed tx pending while it is not found and the blockhash is valid", async () => {
        const connection = createSolanaConnection();
        mockedGetSolanaConnection.mockResolvedValue(connection as never);

        const result = await recoverPendingSolanaOftSend(solanaPendingSend);

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
        expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });

    test("fails when the signed tx blockhash has expired", async () => {
        const connection = createSolanaConnection({
            blockHeight: 101,
        });
        mockedGetSolanaConnection.mockResolvedValue(connection as never);

        const result = await recoverPendingSolanaOftSend(solanaPendingSend);

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
        expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });
});

const tronPendingSend: PendingTronOftBridgeSend = {
    kind: PendingBridgeSendKind.TronOft,
    createdAt: Date.now(),
    sourceAsset: "USDT0-TRON",
    txHash: tronTransactionHash,
};

describe("recoverPendingTronOftSend", () => {
    test("recovers a tx already found on-chain", async () => {
        mockedGetTronTransaction.mockResolvedValue(undefined);
        mockedGetTronTransactionInfo.mockResolvedValue({
            receipt: { result: "SUCCESS" },
        } as never);

        const result = await recoverPendingTronOftSend(tronPendingSend);

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: tronTransactionHash,
        });
    });

    test("keeps a signed tx pending when it is not found on-chain", async () => {
        mockedGetTronTransaction.mockResolvedValue(undefined);
        mockedGetTronTransactionInfo.mockResolvedValue(undefined);

        const result = await recoverPendingTronOftSend(tronPendingSend);

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
    });

    test("fails when the transaction is found failed on-chain", async () => {
        mockedGetTronTransaction.mockResolvedValue(undefined);
        mockedGetTronTransactionInfo.mockResolvedValue({
            result: "FAILED",
            receipt: { result: "REVERT" },
        } as never);

        const result = await recoverPendingTronOftSend(tronPendingSend);

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
    });
});
