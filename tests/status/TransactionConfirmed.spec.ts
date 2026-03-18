import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";

import {
    claimAsset,
    signErc20ClaimToRouter,
} from "../../src/status/TransactionConfirmed";
import type * as EvmTransactionModule from "../../src/utils/evmTransaction";
import type * as QouterModule from "../../src/utils/qouter";
import { satsToAssetAmount } from "../../src/utils/rootstock";
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

vi.mock("../../src/utils/qouter", async () => {
    const actual = await vi.importActual<typeof QouterModule>(
        "../../src/utils/qouter",
    );

    return {
        ...actual,
        gasTopUpSupported: mockGasTopUpSupported,
    };
});

vi.mock("../../src/utils/evmTransaction", () => ({
    getSignerForGasAbstraction: mockGetSignerForGasAbstraction,
    sendPopulatedTransaction: (...args: unknown[]) =>
        mockSendPopulatedTransaction(...args),
}));

describe("TransactionConfirmed claimAsset", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGasTopUpSupported.mockReturnValue(true);
    });

    test("should keep RifRelay as the special relay path", async () => {
        const signer = { address: "0xsigner" };
        const signerAccessor = () => signer;
        const etherSwap = {} as EtherSwap;
        const erc20Swap = {} as ERC20Swap;
        const getGasAbstractionSigner = vi.fn();

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
                0.5,
                signerAccessor as never,
                getGasAbstractionSigner,
                etherSwap,
                erc20Swap,
                false,
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
        expect(getGasAbstractionSigner).not.toHaveBeenCalled();
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
    });

    test("should read the ERC20 swap domain from the active claim signer connection", async () => {
        const signer = {
            signTypedData: vi.fn().mockResolvedValue("0xsigned"),
        };
        const connectedErc20Swap = {
            version: vi.fn().mockResolvedValue(7),
            getAddress: vi
                .fn()
                .mockResolvedValue(
                    "0x1000000000000000000000000000000000000000",
                ),
        };
        const erc20Swap = {
            connect: vi.fn().mockReturnValue(connectedErc20Swap),
            version: vi.fn().mockRejectedValue(new Error("wrong runner")),
            getAddress: vi.fn().mockRejectedValue(new Error("wrong runner")),
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
        ).resolves.toEqual("0xsigned");

        expect(erc20Swap.connect).toHaveBeenCalledWith(signer);
        expect(connectedErc20Swap.version).toHaveBeenCalledTimes(1);
        expect(connectedErc20Swap.getAddress).toHaveBeenCalledTimes(1);
        expect(signer.signTypedData).toHaveBeenCalledWith(
            expect.objectContaining({
                chainId: 31n,
                version: "7",
                verifyingContract: "0x1000000000000000000000000000000000000000",
            }),
            expect.any(Object),
            expect.objectContaining({
                preimage: `0x${"11".repeat(32)}`,
                amount: 123n,
                tokenAddress: "0x2000000000000000000000000000000000000000",
                refundAddress: "0x3000000000000000000000000000000000000000",
                destination: "0x4000000000000000000000000000000000000000",
            }),
        );
    });

    test("should skip router gas top-up claims when the destination asset is unsupported", async () => {
        const signer = { address: "0xsigner" };
        const claimSigner = { provider: {} };
        const signerAccessor = () => signer;
        const getGasAbstractionSigner = vi.fn();
        const populatedTx = { to: "0xclaimtx" };
        const populateTransaction = vi.fn().mockResolvedValue(populatedTx);
        const connectedErc20Swap = {
            "claim(bytes32,uint256,address,address,address,uint256)": {
                populateTransaction,
            },
        };
        const erc20Swap = {
            connect: vi.fn().mockReturnValue(connectedErc20Swap),
        };

        mockGasTopUpSupported.mockReturnValue(false);
        mockGetSignerForGasAbstraction.mockReturnValue(claimSigner as never);
        mockSendPopulatedTransaction.mockResolvedValue("0xdirect");

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
                0.5,
                signerAccessor as never,
                getGasAbstractionSigner,
                {} as EtherSwap,
                erc20Swap as never,
                true,
            ),
        ).resolves.toEqual({
            transactionHash: "0xdirect",
            receiveAmount: satsToAssetAmount(21, "USDT0"),
        });

        expect(mockGasTopUpSupported).toHaveBeenCalledWith("USDT0");
        expect(getGasAbstractionSigner).toHaveBeenCalledWith("USDT0");
        expect(erc20Swap.connect).toHaveBeenCalledWith(claimSigner);
        expect(populateTransaction).toHaveBeenCalledWith(
            `0x${"11".repeat(32)}`,
            satsToAssetAmount(21, "USDT0"),
            "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            "0x1000000000000000000000000000000000000000",
            "0x2000000000000000000000000000000000000000",
            123,
        );
        expect(mockSendPopulatedTransaction).toHaveBeenCalledWith(
            GasAbstractionType.None,
            claimSigner,
            populatedTx,
        );
    });
});
