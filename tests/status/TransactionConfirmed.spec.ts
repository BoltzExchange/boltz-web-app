import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";

import {
    claimAsset,
    signErc20ClaimToRouter,
} from "../../src/status/TransactionConfirmed";
import { satsToAssetAmount } from "../../src/utils/rootstock";
import { GasAbstractionType } from "../../src/utils/swapCreator";

const mockRelayClaimTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();
const mockSendPopulatedTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();

vi.mock("../../src/rif/Signer", () => ({
    relayClaimTransaction: (...args: unknown[]) =>
        mockRelayClaimTransaction(...args),
}));

vi.mock("../../src/utils/evmTransaction", () => ({
    getSignerForGasAbstraction: vi.fn(),
    sendPopulatedTransaction: (...args: unknown[]) =>
        mockSendPopulatedTransaction(...args),
}));

describe("TransactionConfirmed claimAsset", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});
