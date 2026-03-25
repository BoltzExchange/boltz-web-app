import { sendRefundTransaction } from "../../src/components/RefundButton";
import type { AssetType } from "../../src/consts/Assets";
import type { Signer } from "../../src/context/Web3";
import { GasAbstractionType } from "../../src/utils/swapCreator";

const mockSendPopulatedTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();
const mockGetTimelockBlockNumber = vi.fn<() => Promise<number>>();

vi.mock("../../src/utils/evmTransaction", () => ({
    assertTransactionSignerProvider: vi.fn(
        (signer: { provider: unknown }) => signer.provider,
    ),
    getSignerForGasAbstraction: vi.fn(),
    sendPopulatedTransaction: (...args: unknown[]) =>
        mockSendPopulatedTransaction(...args),
}));

vi.mock("../../src/utils/contractLogs", () => ({
    getTimelockBlockNumber: () => mockGetTimelockBlockNumber(),
}));

describe("sendRefundTransaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should fall back to timeout refund after cooperative refund fails past timelock", async () => {
        const provider = {
            waitForTransaction: vi.fn().mockResolvedValue({}),
        };
        const signer = {
            provider,
        } as unknown as Signer;
        const asset = "RBTC" as AssetType;
        const cooperativeError = new Error("cooperative failed");
        const refundCooperative = vi.fn().mockRejectedValue(cooperativeError);
        const refundTimeout = vi.fn().mockResolvedValue({
            to: "0x4000000000000000000000000000000000000000",
        });

        mockGetTimelockBlockNumber.mockResolvedValue(101);
        mockSendPopulatedTransaction.mockResolvedValue("0xrefund");

        await expect(
            sendRefundTransaction(
                GasAbstractionType.Signer,
                signer,
                asset,
                100,
                refundCooperative,
                refundTimeout,
            ),
        ).resolves.toEqual("0xrefund");

        expect(refundCooperative).toHaveBeenCalledTimes(1);
        expect(refundTimeout).toHaveBeenCalledTimes(1);
        expect(mockSendPopulatedTransaction).toHaveBeenCalledWith(
            GasAbstractionType.Signer,
            signer,
            { to: "0x4000000000000000000000000000000000000000" },
        );
        expect(provider.waitForTransaction).toHaveBeenCalledWith("0xrefund", 1);
    });

    test("should rethrow cooperative refund failures before timelock expiry", async () => {
        const provider = {
            waitForTransaction: vi.fn(),
        };
        const signer = {
            provider,
        } as unknown as Signer;
        const asset = "RBTC" as AssetType;
        const cooperativeError = new Error("cooperative failed");
        const refundCooperative = vi.fn().mockRejectedValue(cooperativeError);
        const refundTimeout = vi.fn();

        mockGetTimelockBlockNumber.mockResolvedValue(100);

        await expect(
            sendRefundTransaction(
                GasAbstractionType.None,
                signer,
                asset,
                100,
                refundCooperative,
                refundTimeout,
            ),
        ).rejects.toThrow(cooperativeError);

        expect(refundTimeout).not.toHaveBeenCalled();
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
    });
});
