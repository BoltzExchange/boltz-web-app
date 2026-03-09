import { type Wallet } from "ethers";

import type { Signer } from "../../src/context/Web3";
import { sendPopulatedTransaction } from "../../src/utils/evmTransaction";
import { GasAbstractionType } from "../../src/utils/swapCreator";

const mockAlchemySendTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();

vi.mock("../../src/alchemy/Alchemy", () => ({
    sendTransaction: (...args: unknown[]) =>
        mockAlchemySendTransaction(...args),
}));

describe("evmTransaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should send direct transactions for GasAbstractionType.None", async () => {
        const mockDirectSend = vi.fn().mockResolvedValue({ hash: "0xdirect" });
        const signer = {
            sendTransaction: mockDirectSend,
        } as unknown as Signer;

        await expect(
            sendPopulatedTransaction(GasAbstractionType.None, signer, {
                to: "0x1000000000000000000000000000000000000000",
                data: "0x1234",
            }),
        ).resolves.toEqual("0xdirect");

        expect(mockDirectSend).toHaveBeenCalledWith({
            to: "0x1000000000000000000000000000000000000000",
            data: "0x1234",
        });
        expect(mockAlchemySendTransaction).not.toHaveBeenCalled();
    });

    test("should send via Alchemy for GasAbstractionType.Signer", async () => {
        const signer = {
            provider: {
                getNetwork: vi.fn().mockResolvedValue({ chainId: 31n }),
            },
        } as unknown as Wallet;
        mockAlchemySendTransaction.mockResolvedValue("0xalchemy");

        await expect(
            sendPopulatedTransaction(GasAbstractionType.Signer, signer, {
                to: "0x2000000000000000000000000000000000000000",
                data: "0xabcd",
                value: 5n,
            }),
        ).resolves.toEqual("0xalchemy");

        expect(mockAlchemySendTransaction).toHaveBeenCalledWith(signer, 31n, [
            {
                to: "0x2000000000000000000000000000000000000000",
                data: "0xabcd",
                value: "5",
            },
        ]);
    });

    test("should treat GasAbstractionType.RifRelay as a direct send", async () => {
        const mockDirectSend = vi
            .fn()
            .mockResolvedValue({ hash: "0xrifdirect" });
        const signer = {
            sendTransaction: mockDirectSend,
        } as unknown as Signer;

        await expect(
            sendPopulatedTransaction(GasAbstractionType.RifRelay, signer, {
                to: "0x3000000000000000000000000000000000000000",
            }),
        ).resolves.toEqual("0xrifdirect");

        expect(mockDirectSend).toHaveBeenCalledWith({
            to: "0x3000000000000000000000000000000000000000",
        });
        expect(mockAlchemySendTransaction).not.toHaveBeenCalled();
    });
});
