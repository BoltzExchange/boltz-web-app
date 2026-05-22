import {
    PendingBridgeSendKind,
    PendingBridgeSendRecoveryStatus,
    type PendingEvmCctpBridgeSend,
    type PendingEvmOftBridgeSend,
    type PendingSolanaCctpBridgeSend,
    type PendingSolanaOftBridgeSend,
    type PendingTronOftBridgeSend,
    recoverPendingEvmCctpSend,
    recoverPendingEvmOftSend,
    recoverPendingSolanaCctpSend,
    recoverPendingSolanaOftSend,
    recoverPendingTronOftSend,
} from "boltz-swaps/bridge";
import { cctpMessageSentTopic, tokenMessengerV2Abi } from "boltz-swaps/cctp";
import { oftAbi } from "boltz-swaps/oft";
import { getSolanaConnection } from "boltz-swaps/solana";
import type * as TronChain from "boltz-swaps/tron";
import { getTronTransaction, getTronTransactionInfo } from "boltz-swaps/tron";
import {
    type Hex,
    type PublicClient,
    encodeAbiParameters,
    encodeEventTopics,
    encodeFunctionData,
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
const tokenMessenger = "0x4000000000000000000000000000000000000000";
const messageTransmitter = "0x5000000000000000000000000000000000000000";
const burnToken = "0x6000000000000000000000000000000000000000";
const calldata = "0xabcdef";
const transactionHash =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
const mintRecipient =
    "0x000000000000000000000000060d01c512b89fbce38bb2b4ed77ee4258457bd6";
const destinationCaller =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
const destinationTokenMessenger =
    "0x00000000000000000000000028b5a0e9c621a5badaa536219b3a228c8168cf5d";
const cctpAmount = 482279779n;
const cctpDestinationDomain = 1000;
const cctpMaxFee = 0n;
const cctpMinFinalityThreshold = 1000;
const cctpHookData = "0x";
const cctpCalldata = encodeFunctionData({
    abi: tokenMessengerV2Abi,
    functionName: "depositForBurn",
    args: [
        cctpAmount,
        cctpDestinationDomain,
        mintRecipient as Hex,
        burnToken as Hex,
        destinationCaller as Hex,
        cctpMaxFee,
        cctpMinFinalityThreshold,
    ],
});
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

const cctpPendingSend: PendingEvmCctpBridgeSend = {
    kind: PendingBridgeSendKind.EvmCctp,
    createdAt: 1,
    sender,
    fromNonce: 7,
    fromBlock: 100,
    tokenMessenger,
    messageTransmitter,
    calldata: cctpCalldata,
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

const createCctpDepositForBurnLog = (
    overrides: Partial<{
        transactionHash: string;
        address: string;
        burnToken: string;
        depositor: string;
        amount: bigint;
        destinationDomain: number;
        mintRecipient: string;
        destinationCaller: string;
        maxFee: bigint;
        minFinalityThreshold: number;
        hookData: string;
    }> = {},
) => ({
    address: overrides.address ?? tokenMessenger,
    transactionHash: overrides.transactionHash ?? transactionHash,
    data: encodeAbiParameters(
        [
            { type: "uint256" },
            { type: "bytes32" },
            { type: "uint32" },
            { type: "bytes32" },
            { type: "bytes32" },
            { type: "uint256" },
            { type: "bytes" },
        ],
        [
            overrides.amount ?? cctpAmount,
            (overrides.mintRecipient ?? mintRecipient) as Hex,
            overrides.destinationDomain ?? cctpDestinationDomain,
            destinationTokenMessenger as Hex,
            (overrides.destinationCaller ?? destinationCaller) as Hex,
            overrides.maxFee ?? cctpMaxFee,
            (overrides.hookData ?? cctpHookData) as Hex,
        ],
    ),
    topics: encodeEventTopics({
        abi: tokenMessengerV2Abi,
        eventName: "DepositForBurn",
        args: {
            burnToken: (overrides.burnToken ?? burnToken) as Hex,
            depositor: (overrides.depositor ?? sender) as Hex,
            minFinalityThreshold:
                overrides.minFinalityThreshold ?? cctpMinFinalityThreshold,
        },
    }),
    blockNumber: 101,
    index: 0,
});

const createCctpMessageSentLog = () => ({
    address: messageTransmitter,
    transactionHash,
    data: "0x",
    topics: [cctpMessageSentTopic],
    blockNumber: 101,
    index: 1,
});

const createCctpProvider = ({
    logs = [createCctpDepositForBurnLog()],
    transaction = {
        nonce: 7,
        from: sender,
        to: tokenMessenger,
        value: 0n,
        input: cctpCalldata,
    },
    receipt = {
        status: "success",
        logs: [createCctpDepositForBurnLog(), createCctpMessageSentLog()],
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
            { ...pendingSend, createdAt: Date.now() },
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

    test("fails when a mempool tx is not found before expiry", async () => {
        const result = await recoverPendingEvmOftSend(
            pendingSend,
            createProvider({
                logs: [],
                latestNonce: 7,
                pendingNonce: 8,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
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

describe("recoverPendingEvmCctpSend", () => {
    test("recovers a tx matching sender calldata and MessageSent", async () => {
        const result = await recoverPendingEvmCctpSend(
            cctpPendingSend,
            createCctpProvider(),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash,
        });
    });

    test("filters DepositForBurn logs by indexed burn fields", async () => {
        const provider = createCctpProvider();

        await recoverPendingEvmCctpSend(cctpPendingSend, provider);

        expect(provider.getLogs).toHaveBeenCalledWith(
            expect.objectContaining({
                args: {
                    burnToken,
                    depositor: sender,
                    minFinalityThreshold: 1000,
                },
            }),
        );
    });

    test("recovers when the wallet broadcasts with a higher nonce", async () => {
        const result = await recoverPendingEvmCctpSend(
            cctpPendingSend,
            createCctpProvider({
                transaction: {
                    nonce: 8,
                    from: sender,
                    to: tokenMessenger,
                    value: 0n,
                    input: cctpCalldata,
                },
                latestNonce: 8,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash,
        });
    });

    test("keeps pending while no CCTP burn is found before expiry", async () => {
        const result = await recoverPendingEvmCctpSend(
            { ...cctpPendingSend, createdAt: Date.now() },
            createCctpProvider({ logs: [], latestNonce: 7 }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
    });

    test("keeps pending while the nonce is still in the mempool", async () => {
        const result = await recoverPendingEvmCctpSend(
            { ...cctpPendingSend, createdAt: Date.now() },
            createCctpProvider({
                logs: [],
                latestNonce: 7,
                pendingNonce: 8,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
    });

    test("fails when no CCTP burn is found before expiry", async () => {
        const result = await recoverPendingEvmCctpSend(
            cctpPendingSend,
            createCctpProvider({ logs: [], latestNonce: 7 }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
    });

    test("fails when calldata differs and the nonce is mined", async () => {
        const result = await recoverPendingEvmCctpSend(
            cctpPendingSend,
            createCctpProvider({
                transaction: {
                    nonce: 7,
                    from: sender,
                    to: tokenMessenger,
                    value: 0n,
                    input: "0x123456",
                },
                latestNonce: 8,
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
    });

    test("keeps pending when multiple matching burns are found", async () => {
        const result = await recoverPendingEvmCctpSend(
            cctpPendingSend,
            createCctpProvider({
                logs: [
                    createCctpDepositForBurnLog(),
                    createCctpDepositForBurnLog({
                        transactionHash:
                            "0x2222222222222222222222222222222222222222222222222222222222222222",
                    }),
                ],
                transaction: {
                    nonce: 7,
                    from: sender,
                    to: tokenMessenger,
                    value: 0n,
                    input: cctpCalldata,
                },
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Pending,
        });
    });

    test("ignores burns without a CCTP MessageSent log", async () => {
        const result = await recoverPendingEvmCctpSend(
            cctpPendingSend,
            createCctpProvider({
                latestNonce: 8,
                receipt: {
                    status: "success",
                    logs: [createCctpDepositForBurnLog()],
                },
            }),
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
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

const solanaCctpPendingSend: PendingSolanaCctpBridgeSend = {
    kind: PendingBridgeSendKind.SolanaCctp,
    sourceAsset: "USDC-SOL",
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

describe("recoverPendingSolanaCctpSend", () => {
    test("recovers a signed tx already found on-chain", async () => {
        const connection = createSolanaConnection({
            status: { err: null },
        });
        mockedGetSolanaConnection.mockResolvedValue(connection as never);

        const result = await recoverPendingSolanaCctpSend(
            solanaCctpPendingSend,
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: solanaSignature,
        });
        expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });

    test("fails when the signed tx blockhash has expired", async () => {
        const connection = createSolanaConnection({
            blockHeight: 101,
        });
        mockedGetSolanaConnection.mockResolvedValue(connection as never);

        const result = await recoverPendingSolanaCctpSend(
            solanaCctpPendingSend,
        );

        expect(result).toEqual({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });
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
