import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";

import { claimAsset } from "../../src/status/TransactionConfirmed";
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
});
