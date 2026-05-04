import type * as AlchemyModule from "../../src/alchemy/Alchemy";
import type { Signer } from "../../src/context/Web3";
import {
    prefix0x,
    sendPopulatedTransaction,
} from "../../src/utils/evmTransaction";
import { GasAbstractionType } from "../../src/utils/swapCreator";

const mockAlchemySendTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();

vi.mock("../../src/alchemy/Alchemy", async () => {
    const actual = await vi.importActual<typeof AlchemyModule>(
        "../../src/alchemy/Alchemy",
    );
    return {
        ...actual,
        sendTransaction: (...args: unknown[]) =>
            mockAlchemySendTransaction(...args),
    };
});

describe("evmTransaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should send direct transactions for GasAbstractionType.None", async () => {
        const mockDirectSend = vi.fn().mockResolvedValue({ hash: "0xdirect" });
        const signer = {
            account: { type: "json-rpc" },
            address: "0x1000000000000000000000000000000000000000",
            sendTransaction: mockDirectSend,
        } as unknown as Signer;

        await expect(
            sendPopulatedTransaction(GasAbstractionType.None, signer, {
                to: "0x1000000000000000000000000000000000000000",
                data: "0x1234",
            }),
        ).resolves.toEqual("0xdirect");

        expect(mockDirectSend).toHaveBeenCalledWith(
            expect.objectContaining({
                account: "0x1000000000000000000000000000000000000000",
                to: "0x1000000000000000000000000000000000000000",
                data: "0x1234",
            }),
        );
        expect(mockAlchemySendTransaction).not.toHaveBeenCalled();
    });

    test("should send via Alchemy for GasAbstractionType.Signer", async () => {
        const signer = {
            provider: {
                getChainId: vi.fn().mockResolvedValue(31),
            },
        } as unknown as Signer;
        mockAlchemySendTransaction.mockResolvedValue("0xalchemy");

        await expect(
            sendPopulatedTransaction(GasAbstractionType.Signer, signer, {
                to: "0x2000000000000000000000000000000000000000",
                data: "0xabcd",
                value: 5n,
            }),
        ).resolves.toEqual("0xalchemy");

        expect(mockAlchemySendTransaction).toHaveBeenCalledWith(
            signer,
            31n,
            [
                {
                    to: "0x2000000000000000000000000000000000000000",
                    data: "0xabcd",
                    value: "5",
                },
            ],
            undefined,
        );
    });

    test("should forward Alchemy resume options for GasAbstractionType.Signer", async () => {
        const signer = {
            provider: {
                getChainId: vi.fn().mockResolvedValue(42161),
            },
        } as unknown as Signer;
        const onPreparedCallId = vi.fn();
        mockAlchemySendTransaction.mockResolvedValue("0xalchemy");

        await expect(
            sendPopulatedTransaction(
                GasAbstractionType.Signer,
                signer,
                {
                    to: "0x2000000000000000000000000000000000000000",
                    data: "0xabcd",
                },
                {
                    alchemy: {
                        existingCallId: "0xprepared",
                        onPreparedCallId,
                    },
                },
            ),
        ).resolves.toEqual("0xalchemy");

        expect(mockAlchemySendTransaction).toHaveBeenCalledWith(
            signer,
            42161n,
            [
                {
                    to: "0x2000000000000000000000000000000000000000",
                    data: "0xabcd",
                    value: undefined,
                },
            ],
            {
                existingCallId: "0xprepared",
                onPreparedCallId,
            },
        );
    });

    test("should treat GasAbstractionType.RifRelay as a direct send", async () => {
        const mockDirectSend = vi
            .fn()
            .mockResolvedValue({ hash: "0xrifdirect" });
        const signer = {
            account: { type: "json-rpc" },
            address: "0x3000000000000000000000000000000000000000",
            sendTransaction: mockDirectSend,
        } as unknown as Signer;

        await expect(
            sendPopulatedTransaction(GasAbstractionType.RifRelay, signer, {
                to: "0x3000000000000000000000000000000000000000",
            }),
        ).resolves.toEqual("0xrifdirect");

        expect(mockDirectSend).toHaveBeenCalledWith(
            expect.objectContaining({
                account: "0x3000000000000000000000000000000000000000",
                to: "0x3000000000000000000000000000000000000000",
            }),
        );
        expect(mockAlchemySendTransaction).not.toHaveBeenCalled();
    });
});

describe("prefix0x", () => {
    test("prepends 0x to a raw hex string", () => {
        expect(prefix0x("deadbeef")).toBe("0xdeadbeef");
    });

    test("is idempotent on already-prefixed strings", () => {
        expect(prefix0x("0xdeadbeef")).toBe("0xdeadbeef");
    });

    test("handles the empty string", () => {
        expect(prefix0x("")).toBe("0x");
    });
});
