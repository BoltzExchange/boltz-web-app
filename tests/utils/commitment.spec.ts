const mockPostCommitmentSignature = vi.fn();
const mockPostCommitmentRefundSignature = vi.fn();
const mockGetEipRefundSignature = vi.fn();

vi.mock("../../src/utils/boltzClient", () => ({
    postCommitmentSignature: mockPostCommitmentSignature,
    postCommitmentRefundSignature: mockPostCommitmentRefundSignature,
    getEipRefundSignature: mockGetEipRefundSignature,
}));

const { SwapType } = await import("../../src/consts/Enums");
const {
    emptyPreimageHash,
    isEmptyPreimageHash,
    postCommitmentSignatureForTransaction,
    buildCommitmentRefundAuthMessage,
    getCommitmentRefundSignature,
    getEvmRefundCooperativeSignature,
} = await import("../../src/utils/commitment");

describe("commitment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should parse the lockup event and post the commitment signature", async () => {
        const receipt = {
            logs: [
                {
                    address: "0x1000000000000000000000000000000000000000",
                    data: "0xdeadbeef",
                    topics: ["0xtopic"],
                    index: 7,
                },
            ],
        };
        const provider = {
            waitForTransaction: vi.fn().mockResolvedValue(receipt),
            getNetwork: vi.fn().mockResolvedValue({ chainId: 31n }),
        };
        const signer = {
            provider,
            signTypedData: vi.fn().mockResolvedValue("0xsigned"),
        };
        const connectedErc20Swap = {
            getAddress: vi
                .fn()
                .mockResolvedValue(
                    "0x1000000000000000000000000000000000000000",
                ),
            version: vi.fn().mockResolvedValue("2"),
            interface: {
                parseLog: vi.fn().mockReturnValue({
                    name: "Lockup",
                    args: {
                        amount: 123n,
                        tokenAddress:
                            "0x2000000000000000000000000000000000000000",
                        claimAddress:
                            "0x3000000000000000000000000000000000000000",
                        refundAddress:
                            "0x4000000000000000000000000000000000000000",
                        timelock: 999n,
                        preimageHash: "0xignored",
                    },
                }),
            },
        };
        const erc20Swap = {
            connect: vi.fn().mockReturnValue(connectedErc20Swap),
        };

        await postCommitmentSignatureForTransaction({
            asset: "USDT",
            swapId: "swap-1",
            preimageHash: "11".repeat(32),
            commitmentTxHash: "0xcommitment",
            erc20Swap: erc20Swap as never,
            signer: signer as never,
        });

        expect(provider.waitForTransaction).toHaveBeenCalledWith(
            "0xcommitment",
            1,
            120_000,
        );
        expect(erc20Swap.connect).toHaveBeenCalledWith(provider);
        expect(signer.signTypedData).toHaveBeenCalledWith(
            expect.objectContaining({
                chainId: 31n,
                verifyingContract: "0x1000000000000000000000000000000000000000",
            }),
            expect.any(Object),
            expect.objectContaining({
                preimageHash: `0x${"11".repeat(32)}`,
                amount: 123n,
            }),
        );
        expect(mockPostCommitmentSignature).toHaveBeenCalledWith(
            "USDT",
            "swap-1",
            "0xsigned",
            "0xcommitment",
            7,
            10,
        );
    });

    describe("buildCommitmentRefundAuthMessage", () => {
        test("formats logIndex as 'none' when undefined", () => {
            expect(
                buildCommitmentRefundAuthMessage("RBTC", "0xabc", undefined),
            ).toEqual(
                [
                    "Boltz commitment refund authorization",
                    "chain: RBTC",
                    "transactionHash: 0xabc",
                    "logIndex: none",
                ].join("\n"),
            );
        });

        test("formats numeric logIndex as decimal", () => {
            expect(
                buildCommitmentRefundAuthMessage("USDT", "0xdef", 3),
            ).toEqual(
                [
                    "Boltz commitment refund authorization",
                    "chain: USDT",
                    "transactionHash: 0xdef",
                    "logIndex: 3",
                ].join("\n"),
            );
        });
    });

    describe("isEmptyPreimageHash", () => {
        test("matches the shared empty hash with a 0x prefix", () => {
            expect(isEmptyPreimageHash(emptyPreimageHash)).toBe(true);
        });

        test("matches the shared empty hash without a 0x prefix", () => {
            expect(isEmptyPreimageHash(emptyPreimageHash.slice(2))).toBe(true);
        });

        test("matches case-insensitively", () => {
            expect(isEmptyPreimageHash(emptyPreimageHash.toUpperCase())).toBe(
                true,
            );
        });

        test("returns false for a non-empty preimage hash", () => {
            expect(isEmptyPreimageHash(`0x${"11".repeat(32)}`)).toBe(false);
        });
    });

    describe("getCommitmentRefundSignature", () => {
        test("signs the auth message and posts it to the refund endpoint", async () => {
            mockPostCommitmentRefundSignature.mockResolvedValue({
                signature: "0xrefundSig",
            });
            const signer = {
                signMessage: vi.fn().mockResolvedValue("0xauthSig"),
            };

            const signature = await getCommitmentRefundSignature({
                chainSymbol: "RBTC",
                transactionHash: "0xcommitment",
                logIndex: 4,
                signer: signer as never,
            });

            expect(signer.signMessage).toHaveBeenCalledWith(
                [
                    "Boltz commitment refund authorization",
                    "chain: RBTC",
                    "transactionHash: 0xcommitment",
                    "logIndex: 4",
                ].join("\n"),
            );
            expect(mockPostCommitmentRefundSignature).toHaveBeenCalledWith(
                "RBTC",
                "0xcommitment",
                "0xauthSig",
                4,
            );
            expect(signature).toEqual("0xrefundSig");
        });

        test("uses 'none' when logIndex is undefined", async () => {
            mockPostCommitmentRefundSignature.mockResolvedValue({
                signature: "0xrefundSig",
            });
            const signer = {
                signMessage: vi.fn().mockResolvedValue("0xauthSig"),
            };

            await getCommitmentRefundSignature({
                chainSymbol: "USDT",
                transactionHash: "0xcommitment",
                signer: signer as never,
            });

            expect(signer.signMessage).toHaveBeenCalledWith(
                expect.stringContaining("logIndex: none"),
            );
            expect(mockPostCommitmentRefundSignature).toHaveBeenCalledWith(
                "USDT",
                "0xcommitment",
                "0xauthSig",
                undefined,
            );
        });
    });

    describe("getEvmRefundCooperativeSignature", () => {
        const buildSigner = () => ({
            signMessage: vi.fn().mockResolvedValue("0xauthSig"),
        });

        test("non-commitment lockup uses the swap refund endpoint", async () => {
            mockGetEipRefundSignature.mockResolvedValue({
                signature: "0xswapSig",
            });

            const signature = await getEvmRefundCooperativeSignature({
                isCommitmentLockup: false,
                asset: "RBTC",
                swapId: "swap-1",
                swapType: SwapType.Submarine,
                commitmentTxHash: undefined,
                signer: buildSigner() as never,
            });

            expect(signature).toEqual("0xswapSig");
            expect(mockGetEipRefundSignature).toHaveBeenCalledWith(
                "swap-1",
                SwapType.Submarine,
            );
            expect(mockPostCommitmentRefundSignature).not.toHaveBeenCalled();
        });

        test("non-commitment lockup without swapId throws", async () => {
            await expect(
                getEvmRefundCooperativeSignature({
                    isCommitmentLockup: false,
                    asset: "RBTC",
                    swapId: undefined,
                    signer: buildSigner() as never,
                }),
            ).rejects.toThrow("swap id is required for cooperative refunds");
            expect(mockGetEipRefundSignature).not.toHaveBeenCalled();
        });

        test("commitment lockup with swapId tries the swap refund endpoint first", async () => {
            mockGetEipRefundSignature.mockResolvedValue({
                signature: "0xlinkedSig",
            });

            const signer = buildSigner();
            const signature = await getEvmRefundCooperativeSignature({
                isCommitmentLockup: true,
                asset: "USDC",
                swapId: "swap-2",
                swapType: SwapType.Chain,
                commitmentTxHash: "0xcommitmentTx",
                logIndex: 1,
                signer: signer as never,
            });

            expect(signature).toEqual("0xlinkedSig");
            expect(mockGetEipRefundSignature).toHaveBeenCalledWith(
                "swap-2",
                SwapType.Chain,
            );
            // Linked path succeeded so the unlinked endpoint must not be hit.
            expect(mockPostCommitmentRefundSignature).not.toHaveBeenCalled();
            expect(signer.signMessage).not.toHaveBeenCalled();
        });

        test("commitment lockup falls back to the unlinked endpoint when the swap refund fails", async () => {
            mockGetEipRefundSignature.mockRejectedValue(
                new Error("not eligible for cooperative refund"),
            );
            mockPostCommitmentRefundSignature.mockResolvedValue({
                signature: "0xunlinkedSig",
            });
            const signer = buildSigner();

            const signature = await getEvmRefundCooperativeSignature({
                isCommitmentLockup: true,
                asset: "USDC",
                swapId: "swap-3",
                swapType: SwapType.Chain,
                commitmentTxHash: "0xcommitmentTx",
                logIndex: 2,
                signer: signer as never,
            });

            expect(signature).toEqual("0xunlinkedSig");
            expect(mockGetEipRefundSignature).toHaveBeenCalledWith(
                "swap-3",
                SwapType.Chain,
            );
            expect(mockPostCommitmentRefundSignature).toHaveBeenCalledWith(
                "USDC",
                "0xcommitmentTx",
                "0xauthSig",
                2,
            );
        });

        test("commitment lockup without swapId calls the unlinked endpoint directly", async () => {
            mockPostCommitmentRefundSignature.mockResolvedValue({
                signature: "0xrescueSig",
            });
            const signer = buildSigner();

            const signature = await getEvmRefundCooperativeSignature({
                isCommitmentLockup: true,
                asset: "USDC",
                swapId: undefined,
                commitmentTxHash: "0xcommitmentTx",
                logIndex: undefined,
                signer: signer as never,
            });

            expect(signature).toEqual("0xrescueSig");
            expect(mockGetEipRefundSignature).not.toHaveBeenCalled();
            expect(mockPostCommitmentRefundSignature).toHaveBeenCalledWith(
                "USDC",
                "0xcommitmentTx",
                "0xauthSig",
                undefined,
            );
        });

        test("commitment lockup without commitmentTxHash throws", async () => {
            await expect(
                getEvmRefundCooperativeSignature({
                    isCommitmentLockup: true,
                    asset: "USDC",
                    swapId: undefined,
                    commitmentTxHash: undefined,
                    signer: buildSigner() as never,
                }),
            ).rejects.toThrow("commitment lockup transaction hash is required");
        });

        test("defaults swapType to Submarine when omitted", async () => {
            mockGetEipRefundSignature.mockResolvedValue({
                signature: "0xdefaultSig",
            });

            await getEvmRefundCooperativeSignature({
                isCommitmentLockup: false,
                asset: "RBTC",
                swapId: "swap-4",
                signer: buildSigner() as never,
            });

            expect(mockGetEipRefundSignature).toHaveBeenCalledWith(
                "swap-4",
                SwapType.Submarine,
            );
        });
    });
});

export {};
