import type { Hash } from "viem";

import { sendPopulatedTransaction } from "../../src/evm/sender.ts";
import type { PopulatedEvmTransaction } from "../../src/evm/transaction.ts";
import type { AlchemyCall } from "../../src/interfaces/alchemy.ts";
import type { Signer } from "../../src/interfaces/signer.ts";
import { GasAbstractionType } from "../../src/types.ts";

const { toAlchemyCallMock, sendAlchemyTransactionMock } = vi.hoisted(() => ({
    toAlchemyCallMock: vi.fn(),
    sendAlchemyTransactionMock: vi.fn(),
}));

vi.mock("../../src/evm/alchemy.ts", () => ({
    toAlchemyCall: toAlchemyCallMock,
    sendAlchemyTransaction: sendAlchemyTransactionMock,
}));

describe("sendPopulatedTransaction", () => {
    type FakeAccount = { type: string; address: string };

    const createSigner = (overrides?: {
        accountType?: string;
        address?: string;
        sendTransaction?: ReturnType<typeof vi.fn>;
        getChainId?: ReturnType<typeof vi.fn>;
    }): {
        signer: Signer;
        account: FakeAccount;
        sendTransaction: ReturnType<typeof vi.fn>;
        getChainId: ReturnType<typeof vi.fn>;
    } => {
        const address = overrides?.address ?? "0xSIGNER";
        const account: FakeAccount = {
            type: overrides?.accountType ?? "local",
            address,
        };
        const sendTransaction =
            overrides?.sendTransaction ?? vi.fn().mockResolvedValue("0xabc");
        const getChainId =
            overrides?.getChainId ?? vi.fn().mockResolvedValue(30);

        const signer = {
            account,
            address,
            sendTransaction,
            provider: { getChainId },
            rdns: "test",
        } as unknown as Signer;

        return { signer, account, sendTransaction, getChainId };
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("None / RifRelay branch — direct viem broadcast", () => {
        const transaction: PopulatedEvmTransaction = {
            to: "0x1000000000000000000000000000000000000000",
            data: "0x1234",
            value: 5n,
        };

        test.each([GasAbstractionType.None, GasAbstractionType.RifRelay])(
            "broadcasts with the local account object for %s",
            async (gasAbstraction) => {
                const sendTransaction = vi.fn().mockResolvedValue("0xabc");
                const { signer, account } = createSigner({
                    accountType: "local",
                    sendTransaction,
                });

                await expect(
                    sendPopulatedTransaction(
                        gasAbstraction,
                        signer,
                        transaction,
                    ),
                ).resolves.toBe("0xabc");

                expect(sendTransaction).toHaveBeenCalledTimes(1);
                const params = sendTransaction.mock.calls[0][0];
                expect(params.account).toBe(account);
                expect(params.chain).toBeNull();
                expect(params.to).toBe(
                    "0x1000000000000000000000000000000000000000",
                );
                expect(params.data).toBe("0x1234");
                expect(params.value).toBe(5n);
            },
        );

        test("broadcasts with signer.address for non-local accounts", async () => {
            const sendTransaction = vi.fn().mockResolvedValue("0xdef");
            const { signer } = createSigner({
                accountType: "json-rpc",
                address: "0xSIGNER",
                sendTransaction,
            });

            await expect(
                sendPopulatedTransaction(
                    GasAbstractionType.None,
                    signer,
                    transaction,
                ),
            ).resolves.toBe("0xdef");

            expect(sendTransaction).toHaveBeenCalledTimes(1);
            const params = sendTransaction.mock.calls[0][0];
            expect(params.account).toBe("0xSIGNER");
            expect(params.chain).toBeNull();
        });

        test.each([GasAbstractionType.None, GasAbstractionType.RifRelay])(
            "rejects a batched (array) transaction for %s",
            async (gasAbstraction) => {
                const sendTransaction = vi.fn();
                const { signer } = createSigner({ sendTransaction });
                const batched: AlchemyCall[] = [
                    {
                        to: "0x1000000000000000000000000000000000000000",
                    },
                ];

                await expect(
                    sendPopulatedTransaction(gasAbstraction, signer, batched),
                ).rejects.toThrow(
                    "cannot broadcast batched calls without gas abstraction",
                );
                expect(sendTransaction).not.toHaveBeenCalled();
            },
        );

        describe("transactionHashFromResponse normalization", () => {
            test("returns a plain string response directly", async () => {
                const { signer } = createSigner({
                    sendTransaction: vi.fn().mockResolvedValue("0xstr"),
                });

                await expect(
                    sendPopulatedTransaction(
                        GasAbstractionType.None,
                        signer,
                        transaction,
                    ),
                ).resolves.toBe("0xstr");
            });

            test("extracts a string .hash from an object response", async () => {
                const { signer } = createSigner({
                    sendTransaction: vi
                        .fn()
                        .mockResolvedValue({ hash: "0xobjhash", other: 1 }),
                });

                await expect(
                    sendPopulatedTransaction(
                        GasAbstractionType.None,
                        signer,
                        transaction,
                    ),
                ).resolves.toBe("0xobjhash");
            });

            test.each<[string, unknown]>([
                ["null", null],
                ["a number", 42],
                ["an object with a non-string hash", { hash: 123 }],
                ["an object without a hash key", {}],
            ])("throws when the response is %s", async (_label, response) => {
                const { signer } = createSigner({
                    sendTransaction: vi.fn().mockResolvedValue(response),
                });

                await expect(
                    sendPopulatedTransaction(
                        GasAbstractionType.None,
                        signer,
                        transaction,
                    ),
                ).rejects.toThrow(
                    "transaction response did not include a hash",
                );
            });
        });
    });

    describe("Signer branch — Alchemy gas abstraction", () => {
        test("wraps a single transaction via toAlchemyCall and forwards to sendAlchemyTransaction", async () => {
            const alchemyCall: AlchemyCall = {
                to: "0x1000000000000000000000000000000000000000",
                data: "0x12",
                value: "7",
            };
            toAlchemyCallMock.mockReturnValue(alchemyCall);
            sendAlchemyTransactionMock.mockResolvedValue("0xalchemy" as Hash);

            const getChainId = vi.fn().mockResolvedValue(30);
            const { signer } = createSigner({ getChainId });
            const transaction: PopulatedEvmTransaction = {
                to: "0x1000000000000000000000000000000000000000",
                data: "0x12",
                value: 7n,
            };

            await expect(
                sendPopulatedTransaction(
                    GasAbstractionType.Signer,
                    signer,
                    transaction,
                ),
            ).resolves.toBe("0xalchemy");

            expect(toAlchemyCallMock).toHaveBeenCalledTimes(1);
            expect(toAlchemyCallMock).toHaveBeenCalledWith(transaction);

            expect(sendAlchemyTransactionMock).toHaveBeenCalledTimes(1);
            const [signerArg, chainIdArg, callsArg] =
                sendAlchemyTransactionMock.mock.calls[0];
            expect(signerArg).toBe(signer);
            expect(chainIdArg).toBe(30n);
            expect(callsArg).toEqual([alchemyCall]);
        });

        test("passes an already-batched AlchemyCall[] through without calling toAlchemyCall", async () => {
            sendAlchemyTransactionMock.mockResolvedValue("0xalchemy" as Hash);

            const { signer } = createSigner();
            const calls: AlchemyCall[] = [
                { to: "0xA", data: "0x1" },
                { to: "0xB" },
            ];

            await expect(
                sendPopulatedTransaction(
                    GasAbstractionType.Signer,
                    signer,
                    calls,
                ),
            ).resolves.toBe("0xalchemy");

            expect(toAlchemyCallMock).not.toHaveBeenCalled();
            expect(sendAlchemyTransactionMock).toHaveBeenCalledTimes(1);
            const callsArg = sendAlchemyTransactionMock.mock.calls[0][2];
            expect(callsArg).toBe(calls);
        });
    });

    describe("default branch — exhaustive guard", () => {
        test("throws for an unsupported gas abstraction type", async () => {
            const { signer } = createSigner();

            await expect(
                sendPopulatedTransaction(
                    "bogus" as unknown as GasAbstractionType,
                    signer,
                    { to: "0x1000000000000000000000000000000000000000" },
                ),
            ).rejects.toThrow(/Unsupported gas abstraction type: bogus/);
        });
    });
});
