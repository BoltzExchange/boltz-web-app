// @vitest-environment node
import { cctpEmptyHookData, cctpZeroBytes32 } from "../../src/utils/cctp/evm";
import type * as SolanaChainModule from "../../src/utils/chains/solana";

const mockState = vi.hoisted(() => ({
    ownerAddress: "11111111111111111111111111111112",
    tokenAccount: "11111111111111111111111111111113",
    connection: {
        getLatestBlockhash: vi.fn(),
        simulateTransaction: vi.fn(),
        confirmTransaction: vi.fn(),
    },
}));

const ownerAddress = mockState.ownerAddress;
const tokenMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const recipient =
    "0x0000000000000000000000001234567890123456789012345678901234567890";
const connection = mockState.connection;

vi.mock("../../src/utils/chains/solana", async () => {
    const actual = await vi.importActual<typeof SolanaChainModule>(
        "../../src/utils/chains/solana",
    );

    return {
        ...actual,
        getConnectedSolanaWalletAddress: vi
            .fn()
            .mockResolvedValue(mockState.ownerAddress),
        getSolanaAssociatedTokenAddress: vi
            .fn()
            .mockResolvedValue(mockState.tokenAccount),
        getSolanaConnection: vi.fn().mockResolvedValue(mockState.connection),
    };
});

const { createSolanaCctpContract } =
    await import("../../src/utils/cctp/solana");

const createWalletProvider = () => ({
    getAccounts: vi.fn().mockResolvedValue([{ address: ownerAddress }]),
    signAndSendTransaction: vi.fn().mockResolvedValue("solana-signature"),
});

const sendParam = {
    amount: 1_000_000n,
    destinationDomain: 3,
    mintRecipient: recipient,
    destinationCaller: cctpZeroBytes32,
    maxFee: 131n,
    minFinalityThreshold: 1000,
    hookData: cctpEmptyHookData,
};

describe("Solana CCTP send", () => {
    beforeEach(() => {
        connection.getLatestBlockhash.mockResolvedValue({
            blockhash: "11111111111111111111111111111111",
            lastValidBlockHeight: 123,
        });
        connection.simulateTransaction.mockResolvedValue({
            value: { err: null, logs: null },
        });
        connection.confirmTransaction.mockResolvedValue({
            value: { err: null },
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("simulates, partially signs, wallet-signs, and submits", async () => {
        const walletProvider = createWalletProvider();
        const contract = createSolanaCctpContract({
            asset: "USDC-SOL",
            tokenMint,
            walletProvider: walletProvider as never,
        });

        const tx = await contract.send(sendParam, [0n, 0n], ownerAddress);

        expect(tx.hash).toBe("solana-signature");
        expect(tx.details?.solana).toEqual({
            blockhash: "11111111111111111111111111111111",
        });
        expect(connection.simulateTransaction).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                sigVerify: false,
                replaceRecentBlockhash: true,
                commitment: "confirmed",
            }),
        );
        expect(walletProvider.signAndSendTransaction).toHaveBeenCalledTimes(1);

        const [transaction, sendOptions] =
            walletProvider.signAndSendTransaction.mock.calls[0];
        expect(sendOptions).toMatchObject({
            skipPreflight: true,
            preflightCommitment: "confirmed",
        });
        expect(
            transaction.signatures.some((signature: Uint8Array) =>
                signature.some((byte) => byte !== 0),
            ),
        ).toBe(true);

        await tx.wait();
        expect(connection.confirmTransaction).toHaveBeenCalledWith(
            {
                signature: "solana-signature",
                blockhash: "11111111111111111111111111111111",
                lastValidBlockHeight: 123,
            },
            "confirmed",
        );
    });

    test("throws simulation failure with Solana logs", async () => {
        connection.simulateTransaction.mockResolvedValue({
            value: {
                err: { InstructionError: [1, "Custom"] },
                logs: ["Program log: first", "Program log: second"],
            },
        });
        const walletProvider = createWalletProvider();
        const contract = createSolanaCctpContract({
            asset: "USDC-SOL",
            tokenMint,
            walletProvider: walletProvider as never,
        });

        await expect(
            contract.send(sendParam, [0n, 0n], ownerAddress),
        ).rejects.toThrow(
            'Simulation failed: {"InstructionError":[1,"Custom"]}\nLogs:\nProgram log: first\nProgram log: second',
        );
        expect(walletProvider.signAndSendTransaction).not.toHaveBeenCalled();
    });

    test("rejects hook data until Solana source hooks are supported", async () => {
        const walletProvider = createWalletProvider();
        const contract = createSolanaCctpContract({
            asset: "USDC-SOL",
            tokenMint,
            walletProvider: walletProvider as never,
        });

        await expect(
            contract.send(
                {
                    ...sendParam,
                    hookData: "0x01",
                },
                [0n, 0n],
                ownerAddress,
            ),
        ).rejects.toThrow("Solana CCTP source sends do not support hook data");
    });
});
