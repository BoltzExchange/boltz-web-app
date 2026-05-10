import { satsToAssetAmount } from "boltz-swaps/evm";

import type { Signer } from "../../src/context/Web3";
import type {
    Erc20SwapContract,
    EtherSwapContract,
} from "../../src/context/contracts";
import {
    normalizePersistedReceiveAmount,
    signErc20ClaimToRouter,
} from "../../src/status/TransactionConfirmed";
import type * as EvmTransactionModule from "../../src/utils/evmTransaction";
import { claimAsset } from "../../src/utils/evmTransaction";
import type * as QouterModule from "../../src/utils/quoter";
import { GasAbstractionType } from "../../src/utils/swapCreator";

const {
    mockGasTopUpSupported,
    mockGetSignerForGasAbstraction,
    mockRelayClaimTransaction,
    mockSendPopulatedTransaction,
} = vi.hoisted(() => ({
    mockGasTopUpSupported: vi.fn<typeof QouterModule.gasTopUpSupported>(),
    mockGetSignerForGasAbstraction:
        vi.fn<typeof EvmTransactionModule.getSignerForGasAbstraction>(),
    mockRelayClaimTransaction: vi.fn<(...args: unknown[]) => Promise<string>>(),
    mockSendPopulatedTransaction:
        vi.fn<(...args: unknown[]) => Promise<string>>(),
}));

vi.mock("../../src/rif/Signer", () => ({
    relayClaimTransaction: (...args: unknown[]) =>
        mockRelayClaimTransaction(...args),
}));

vi.mock("../../src/utils/quoter", async () => {
    const actual = await vi.importActual<typeof QouterModule>(
        "../../src/utils/quoter",
    );

    return {
        ...actual,
        gasTopUpSupported: mockGasTopUpSupported,
    };
});

vi.mock("../../src/utils/evmTransaction", async () => {
    const actual = await vi.importActual<typeof EvmTransactionModule>(
        "../../src/utils/evmTransaction",
    );

    return {
        ...actual,
        getSignerForGasAbstraction: mockGetSignerForGasAbstraction,
        sendPopulatedTransaction: (...args: unknown[]) =>
            mockSendPopulatedTransaction(...args),
    };
});

describe("TransactionConfirmed claimAsset", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGasTopUpSupported.mockReturnValue(true);
    });

    test("should keep RifRelay as the special relay path", async () => {
        const signer = { address: "0xsigner" };
        const signerAccessor = () => signer;
        const etherSwap = {} as EtherSwapContract;
        const erc20Swap = {} as Erc20SwapContract;
        const gasAbstractionSigner = {} as Signer;

        mockRelayClaimTransaction.mockResolvedValue("0xrelay");

        await expect(
            claimAsset(
                GasAbstractionType.RifRelay,
                "RBTC",
                "preimage",
                21,
                "0xclaim",
                "0xrefund",
                123,
                "0xdestination",
                signerAccessor as never,
                gasAbstractionSigner,
                etherSwap,
                erc20Swap,
            ),
        ).resolves.toEqual({
            transactionHash: "0xrelay",
            receiveAmount: satsToAssetAmount(21, "RBTC"),
        });

        expect(mockRelayClaimTransaction).toHaveBeenCalledWith(
            signer,
            etherSwap,
            "preimage",
            21,
            "0xrefund",
            123,
        );
    });

    test("should accept satoshi amount as bigint for RifRelay", async () => {
        const signer = { address: "0xsigner" };
        const signerAccessor = () => signer;
        const etherSwap = {} as EtherSwapContract;
        const erc20Swap = {} as Erc20SwapContract;
        const gasAbstractionSigner = {} as Signer;

        mockRelayClaimTransaction.mockResolvedValue("0xrelay");

        const sats = 9_000_000_000_001n;

        await expect(
            claimAsset(
                GasAbstractionType.RifRelay,
                "RBTC",
                "preimage",
                sats,
                "0xclaim",
                "0xrefund",
                123,
                "0xdestination",
                signerAccessor as never,
                gasAbstractionSigner,
                etherSwap,
                erc20Swap,
            ),
        ).resolves.toEqual({
            transactionHash: "0xrelay",
            receiveAmount: satsToAssetAmount(sats, "RBTC"),
        });

        expect(mockRelayClaimTransaction).toHaveBeenCalledWith(
            signer,
            etherSwap,
            "preimage",
            sats,
            "0xrefund",
            123,
        );
    });

    test("should normalize RBTC receive amounts to satoshis", () => {
        expect(
            normalizePersistedReceiveAmount(
                satsToAssetAmount(51_990, "RBTC"),
                "RBTC",
            ),
        ).toEqual("51990");
    });

    test("should keep routed ERC20 receive amounts in token units", () => {
        expect(
            normalizePersistedReceiveAmount(
                satsToAssetAmount(51_990, "USDT0"),
                "USDT0",
            ),
        ).toEqual(satsToAssetAmount(51_990, "USDT0").toString());
    });

    test("should read the ERC20 swap domain from the active claim signer connection", async () => {
        const signer = {
            signTypedData: vi
                .fn()
                .mockResolvedValue(`0x${"b".repeat(64)}${"c".repeat(64)}1b`),
        };
        const erc20Swap = {
            address: "0x1000000000000000000000000000000000000000",
            read: {
                version: vi.fn().mockResolvedValue(7),
            },
        };

        await expect(
            signErc20ClaimToRouter(
                signer as never,
                erc20Swap as never,
                31n,
                "11".repeat(32),
                123n,
                "0x2000000000000000000000000000000000000000",
                "0x3000000000000000000000000000000000000000",
                144,
                "0x4000000000000000000000000000000000000000",
            ),
        ).resolves.toMatchObject({
            r: `0x${"b".repeat(64)}`,
            s: `0x${"c".repeat(64)}`,
        });

        expect(erc20Swap.read.version).toHaveBeenCalledTimes(1);
        expect(signer.signTypedData).toHaveBeenCalledWith(
            expect.objectContaining({
                domain: expect.objectContaining({
                    chainId: 31n,
                    version: "7",
                    verifyingContract:
                        "0x1000000000000000000000000000000000000000",
                }),
                primaryType: "Claim",
                types: expect.any(Object),
                message: expect.objectContaining({
                    preimage: `0x${"11".repeat(32)}`,
                    amount: 123n,
                    tokenAddress: "0x2000000000000000000000000000000000000000",
                    refundAddress: "0x3000000000000000000000000000000000000000",
                    destination: "0x4000000000000000000000000000000000000000",
                }),
            }),
        );
    });

    test("should use direct ERC20 claim path", async () => {
        const erc20Swap = {
            address: "0x5000000000000000000000000000000000000000",
        };
        const signer = {
            account: { type: "json-rpc" },
            address: "0xsigner",
            sendTransaction: vi.fn().mockResolvedValue({ hash: "0xdirect" }),
        };
        const signerAccessor = () => signer;
        const gasAbstractionSigner = {} as Signer;

        await expect(
            claimAsset(
                GasAbstractionType.None,
                "USDT0",
                "11".repeat(32),
                21,
                "0x1000000000000000000000000000000000000000",
                "0x2000000000000000000000000000000000000000",
                123,
                "0x3000000000000000000000000000000000000000",
                signerAccessor as never,
                gasAbstractionSigner,
                {} as EtherSwapContract,
                erc20Swap as never,
            ),
        ).resolves.toEqual({
            transactionHash: "0xdirect",
            receiveAmount: satsToAssetAmount(21, "USDT0"),
        });

        expect(signer.sendTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                to: erc20Swap.address,
                data: expect.stringMatching(/^0x/),
            }),
        );
    });
});
