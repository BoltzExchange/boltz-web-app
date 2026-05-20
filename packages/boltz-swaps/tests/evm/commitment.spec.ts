import { setBoltzSwapsConfig } from "boltz-swaps/config";
import {
    buildCommitmentRefundAuthMessage,
    emptyPreimageHash,
    getCommitmentRefundSignature,
    getEvmRefundCooperativeSignature,
    isEmptyPreimageHash,
    postCommitmentSignatureForTransaction,
} from "boltz-swaps/evm/commitment";
import { erc20SwapAbi } from "boltz-swaps/generated/evm-abis";
import { SwapType } from "boltz-swaps/types";
import {
    type PublicClient,
    encodeAbiParameters,
    encodeEventTopics,
} from "viem";

import type * as ClientModule from "../../src/client.ts";
import type * as ProviderModule from "../../src/evm/provider.ts";

const {
    mockPostCommitmentSignature,
    mockPostCommitmentRefundSignature,
    mockGetEipRefundSignature,
    mockCreateAssetProvider,
    sentinelAssetProvider,
} = vi.hoisted(() => {
    const sentinelAssetProvider = {
        waitForTransactionReceipt: vi.fn(),
    } as unknown as PublicClient;
    return {
        mockPostCommitmentSignature: vi.fn(),
        mockPostCommitmentRefundSignature: vi.fn(),
        mockGetEipRefundSignature: vi.fn(),
        mockCreateAssetProvider: vi.fn(),
        sentinelAssetProvider,
    };
});

vi.mock("../../src/evm/provider.ts", async (importActual) => ({
    ...(await importActual<typeof ProviderModule>()),
    createAssetProvider: mockCreateAssetProvider,
}));

vi.mock("../../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    postCommitmentSignature: mockPostCommitmentSignature,
    postCommitmentRefundSignature: mockPostCommitmentRefundSignature,
    getEipRefundSignature: mockGetEipRefundSignature,
}));

let chainIdForAsset = 31;

describe("commitment", () => {
    beforeAll(() => {
        setBoltzSwapsConfig({
            // Override `assets` proxy to a stub so requireChainId(asset) returns
            // chainIdForAsset for any commitment-asset symbol used in tests.
            get assets() {
                return new Proxy(
                    {},
                    {
                        get: () => ({
                            network: { chainId: chainIdForAsset },
                        }),
                    },
                );
            },
        });
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateAssetProvider.mockReturnValue(sentinelAssetProvider);
        chainIdForAsset = 31;
    });

    const buildLockupReceipt = () => ({
        logs: [
            {
                address: "0x1000000000000000000000000000000000000000",
                data: encodeAbiParameters(
                    [
                        { type: "uint256" },
                        { type: "address" },
                        { type: "uint256" },
                    ],
                    [123n, "0x2000000000000000000000000000000000000000", 999n],
                ),
                topics: encodeEventTopics({
                    abi: erc20SwapAbi,
                    eventName: "Lockup",
                    args: {
                        preimageHash: `0x${"11".repeat(32)}`,
                        claimAddress:
                            "0x3000000000000000000000000000000000000000",
                        refundAddress:
                            "0x4000000000000000000000000000000000000000",
                    },
                }),
                logIndex: 7,
            },
        ],
    });

    test("should parse the lockup event and post the commitment signature", async () => {
        const receipt = buildLockupReceipt();
        (
            sentinelAssetProvider.waitForTransactionReceipt as ReturnType<
                typeof vi.fn
            >
        ).mockResolvedValue(receipt);
        const signer = {
            // Wallet's provider — must NEVER be reached. The receipt fetch
            // and chainId derivation both belong to the commitment chain.
            provider: {
                waitForTransactionReceipt: vi.fn(),
                getChainId: vi.fn(),
            },
            signTypedData: vi.fn().mockResolvedValue("0xsigned"),
        };
        const erc20Swap = {
            address: "0x1000000000000000000000000000000000000000",
            abi: erc20SwapAbi,
            read: {
                version: vi.fn().mockResolvedValue("2"),
            },
        };

        await postCommitmentSignatureForTransaction({
            asset: "USDT",
            commitmentAsset: "RBTC",
            swapId: "swap-1",
            preimageHash: "11".repeat(32),
            commitmentTxHash: "0xcommitment",
            erc20Swap: erc20Swap as never,
            signer: signer as never,
        });

        expect(mockCreateAssetProvider).toHaveBeenCalledWith("RBTC");
        expect(
            sentinelAssetProvider.waitForTransactionReceipt,
        ).toHaveBeenCalledWith({
            hash: "0xcommitment",
            confirmations: 1,
            timeout: 120_000,
        });
        expect(
            signer.provider.waitForTransactionReceipt,
        ).not.toHaveBeenCalled();
        expect(signer.provider.getChainId).not.toHaveBeenCalled();
        expect(signer.signTypedData).toHaveBeenCalledWith(
            expect.objectContaining({
                domain: expect.objectContaining({
                    chainId: 31n,
                    verifyingContract:
                        "0x1000000000000000000000000000000000000000",
                }),
                message: expect.objectContaining({
                    preimageHash: `0x${"11".repeat(32)}`,
                    amount: 123n,
                }),
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

    test("uses the commitmentAsset chainId in the EIP-712 domain regardless of the wallet's chain", async () => {
        const receipt = buildLockupReceipt();
        (
            sentinelAssetProvider.waitForTransactionReceipt as ReturnType<
                typeof vi.fn
            >
        ).mockResolvedValue(receipt);
        chainIdForAsset = 30;
        const signer = {
            provider: {
                getChainId: vi.fn().mockResolvedValue(137),
                waitForTransactionReceipt: vi.fn(),
            },
            signTypedData: vi.fn().mockResolvedValue("0xsigned"),
        };
        const erc20Swap = {
            address: "0x1000000000000000000000000000000000000000",
            abi: erc20SwapAbi,
            read: { version: vi.fn().mockResolvedValue("2") },
        };

        await postCommitmentSignatureForTransaction({
            asset: "USDT",
            commitmentAsset: "RBTC",
            swapId: "swap-x",
            preimageHash: "11".repeat(32),
            commitmentTxHash: "0xcommitment",
            erc20Swap: erc20Swap as never,
            signer: signer as never,
        });

        const [signTypedDataArgs] = signer.signTypedData.mock.calls[0];
        expect(signTypedDataArgs.domain.chainId).toBe(30n);
        expect(signer.provider.getChainId).not.toHaveBeenCalled();
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

            expect(signer.signMessage).toHaveBeenCalledWith({
                message: [
                    "Boltz commitment refund authorization",
                    "chain: RBTC",
                    "transactionHash: 0xcommitment",
                    "logIndex: 4",
                ].join("\n"),
            });
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
                expect.objectContaining({
                    message: expect.stringContaining("logIndex: none"),
                }),
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
