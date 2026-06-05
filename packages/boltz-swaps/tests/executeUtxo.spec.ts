import {
    type ChainSwapExecuteArgs,
    executeChainSwap,
    setBoltzSwapsConfig,
} from "boltz-swaps";

import type * as FetcherModule from "../src/http/fetcher.ts";

const { fetcherMock, claimUtxoMock } = vi.hoisted(() => ({
    fetcherMock: vi.fn(),
    claimUtxoMock: vi.fn(),
}));

vi.mock("../src/http/fetcher.ts", async (importActual) => ({
    ...(await importActual<typeof FetcherModule>()),
    fetcher: fetcherMock,
}));

vi.mock("../src/utxo/claim.ts", () => ({
    claimChainSwapUtxo: claimUtxoMock,
}));

const claimKeys = {
    privateKey: new Uint8Array(32).fill(1),
    publicKey: new Uint8Array(33).fill(2),
};

const createdSwap = {
    id: "swap-1",
    claimDetails: {
        swapTree: {} as never,
        lockupAddress: "bcrt1qlockup",
        serverPublicKey: "02ab",
        timeoutBlockHeight: 100,
        amount: 50_000,
        claimAddress: "bcrt1qserver",
        refundAddress: "bcrt1qserver",
    },
    lockupDetails: { swapTree: {} as never } as never,
};

const utxoArgs = (
    overrides: Partial<ChainSwapExecuteArgs> = {},
): ChainSwapExecuteArgs => ({
    createdSwap,
    to: "BTC",
    preimage: "11".repeat(32),
    claimAddress: "bcrt1quser",
    utxoClaim: { claimKeys, receiveAmount: 49_800 },
    ...overrides,
});

beforeEach(() => {
    fetcherMock.mockReset();
    claimUtxoMock.mockReset();
    fetcherMock.mockImplementation(async (url: string) => {
        if (url.endsWith("/transactions")) {
            return {
                userLock: {},
                serverLock: {
                    transaction: { id: "lock-id", hex: "deadbeef" },
                },
            };
        }
        if (url.includes("/v2/chain/") && url.endsWith("/transaction")) {
            return { id: "broadcast-id" };
        }
        return {};
    });
    claimUtxoMock.mockResolvedValue({
        transactionHex: "rawtxhex",
        transactionId: "claim-txid",
    });
    setBoltzSwapsConfig({ network: "regtest" });
});

describe("executeChainSwap: UTXO destination", () => {
    test("claims via the UTXO module and broadcasts the claim tx", async () => {
        const result = await executeChainSwap(utxoArgs());

        expect(result).toEqual({
            claimTransactionId: "claim-txid",
            receiveAmount: 49_800n,
        });
        expect(claimUtxoMock).toHaveBeenCalledTimes(1);
        expect(claimUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "swap-1",
                asset: "BTC",
                network: "regtest",
                serverPublicKey: "02ab",
                claimAddress: "bcrt1quser",
                receiveAmount: 49_800,
                lockupTxHex: "deadbeef",
                claimKeys,
            }),
        );
        expect(fetcherMock).toHaveBeenCalledWith("/v2/chain/BTC/transaction", {
            hex: "rawtxhex",
        });
    });

    test("requires utxoClaim keys", async () => {
        await expect(
            executeChainSwap(utxoArgs({ utxoClaim: undefined })),
        ).rejects.toThrow(/requires utxoClaim keys/);
        expect(claimUtxoMock).not.toHaveBeenCalled();
    });
});
