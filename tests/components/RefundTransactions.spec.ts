import { sendRefundTransaction } from "../../src/components/RefundButton";
import type { Signer } from "../../src/context/Web3";
import { GasAbstractionType } from "../../src/utils/swapCreator";

const mockSendPopulatedTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();

vi.mock("../../src/utils/evmTransaction", () => ({
    getSignerForGasAbstraction: vi.fn(),
    sendPopulatedTransaction: (...args: unknown[]) =>
        mockSendPopulatedTransaction(...args),
}));

describe("sendRefundTransaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should fall back to timeout refund after cooperative refund fails past timelock", async () => {
        const provider = {
            getBlockNumber: vi.fn().mockResolvedValue(101),
            waitForTransaction: vi.fn().mockResolvedValue({}),
        };
        const signer = {
            provider,
        } as unknown as Signer;
        const cooperativeError = new Error("cooperative failed");
        const refundCooperative = vi.fn().mockRejectedValue(cooperativeError);
        const refundTimeout = vi.fn().mockResolvedValue({
            to: "0x4000000000000000000000000000000000000000",
        });

        mockSendPopulatedTransaction.mockResolvedValue("0xrefund");

        await expect(
            sendRefundTransaction(
                GasAbstractionType.Signer,
                signer,
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
            getBlockNumber: vi.fn().mockResolvedValue(100),
            waitForTransaction: vi.fn(),
        };
        const signer = {
            provider,
        } as unknown as Signer;
        const cooperativeError = new Error("cooperative failed");
        const refundCooperative = vi.fn().mockRejectedValue(cooperativeError);
        const refundTimeout = vi.fn();

        await expect(
            sendRefundTransaction(
                GasAbstractionType.None,
                signer,
                100,
                refundCooperative,
                refundTimeout,
            ),
        ).rejects.toThrow(cooperativeError);

        expect(refundTimeout).not.toHaveBeenCalled();
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
    });
});
