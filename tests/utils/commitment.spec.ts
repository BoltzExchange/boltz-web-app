const mockPostCommitmentSignature = vi.fn();
const mockPostCommitmentRefundSignature = vi.fn();

vi.mock("../../src/utils/boltzClient", () => ({
    postCommitmentSignature: mockPostCommitmentSignature,
    postCommitmentRefundSignature: mockPostCommitmentRefundSignature,
}));

const {
    postCommitmentSignatureForTransaction,
    buildCommitmentRefundAuthMessage,
    getCommitmentRefundSignature,
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
});

export {};
