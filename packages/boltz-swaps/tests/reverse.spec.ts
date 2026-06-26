import {
    AssetKind,
    GasAbstractionType,
    NetworkTransport,
    type ReverseExecuteArgs,
    executeReverseSwap,
    setBoltzSwapsConfig,
} from "boltz-swaps";
import { getAddress } from "viem";

import type * as SwapContractsModule from "../src/evm/swapContracts.ts";
import type * as TransactionModule from "../src/evm/transaction.ts";
import type * as FetcherModule from "../src/http/fetcher.ts";

const {
    fetcherMock,
    claimReverseUtxoMock,
    buildSwapContractsForAssetMock,
    claimAssetMock,
} = vi.hoisted(() => ({
    fetcherMock: vi.fn(),
    claimReverseUtxoMock: vi.fn(),
    buildSwapContractsForAssetMock: vi.fn(),
    claimAssetMock: vi.fn(),
}));

vi.mock("../src/http/fetcher.ts", async (importActual) => ({
    ...(await importActual<typeof FetcherModule>()),
    fetcher: fetcherMock,
}));

vi.mock("../src/utxo/claim.ts", () => ({
    claimReverseUtxo: claimReverseUtxoMock,
}));

vi.mock("../src/evm/swapContracts.ts", async (importActual) => ({
    ...(await importActual<typeof SwapContractsModule>()),
    buildSwapContractsForAsset: buildSwapContractsForAssetMock,
}));

vi.mock("../src/evm/transaction.ts", async (importActual) => ({
    ...(await importActual<typeof TransactionModule>()),
    claimAsset: claimAssetMock,
}));

const REFUND = "0x000000000000000000000000000000000000dead";
const CLAIM = "0x1111111111111111111111111111111111111111";
const DESTINATION = "0x2222222222222222222222222222222222222222";

const createdReverseEvm = {
    id: "rev-evm",
    invoice: "lnbcrt1",
    swapTree: {} as never,
    lockupAddress: "0xcontract",
    timeoutBlockHeight: 222,
    onchainAmount: 100_000,
    refundAddress: REFUND,
};

const createdReverseUtxo = {
    id: "rev-utxo",
    invoice: "lnbcrt2",
    swapTree: {} as never,
    lockupAddress: "bcrt1qlock",
    timeoutBlockHeight: 100,
    onchainAmount: 50_000,
    refundPublicKey: "02ab",
    blindingKey: undefined,
};

const claimKeys = {
    privateKey: new Uint8Array(32).fill(1),
    publicKey: new Uint8Array(33).fill(2),
};

const evmArgs = (
    overrides: Partial<ReverseExecuteArgs> = {},
): ReverseExecuteArgs => ({
    createdSwap: createdReverseEvm,
    to: "TBTC",
    preimage: "0xpre",
    receiveAmount: 99_000,
    claimAddress: CLAIM,
    signer: {} as never,
    ...overrides,
});

const utxoArgs = (
    overrides: Partial<ReverseExecuteArgs> = {},
): ReverseExecuteArgs => ({
    createdSwap: createdReverseUtxo,
    to: "BTC",
    preimage: "11".repeat(32),
    receiveAmount: 49_800,
    claimAddress: "bcrt1quser",
    claimKeys,
    ...overrides,
});

beforeEach(() => {
    fetcherMock.mockReset();
    claimReverseUtxoMock.mockReset();
    buildSwapContractsForAssetMock.mockReset();
    claimAssetMock.mockReset();

    fetcherMock.mockImplementation(async (url: string) => {
        if (url.includes("/v2/swap/reverse/") && url.endsWith("/transaction")) {
            return { id: "lock-id", hex: "deadbeef", timeoutBlockHeight: 100 };
        }
        if (url.includes("/v2/chain/") && url.endsWith("/transaction")) {
            return { id: "broadcast-id" };
        }
        return {};
    });
    claimReverseUtxoMock.mockResolvedValue({
        transactionHex: "rawtxhex",
        transactionId: "claim-txid",
    });
    buildSwapContractsForAssetMock.mockResolvedValue({
        etherSwap: { address: "0xe" },
        erc20Swap: { address: "0xr" },
    });
    claimAssetMock.mockResolvedValue({
        transactionHash: "0xclaimtx",
        receiveAmount: 99_000n,
    });

    setBoltzSwapsConfig({
        network: "regtest",
        assets: {
            TBTC: {
                type: AssetKind.ERC20,
                network: {
                    chainName: "Arbitrum",
                    symbol: "TBTC",
                    gasToken: "ETH",
                    transport: NetworkTransport.Evm,
                    chainId: 42161,
                    rpcUrls: ["http://localhost"],
                },
                token: { address: CLAIM, decimals: 18 },
            },
            RBTC: {
                type: AssetKind.EVMNative,
                network: {
                    chainName: "Rootstock",
                    symbol: "RBTC",
                    gasToken: "RBTC",
                    transport: NetworkTransport.Evm,
                    chainId: 30,
                    rpcUrls: ["http://localhost"],
                },
            },
        } as never,
    });
});

describe("executeReverseSwap: EVM destination", () => {
    test("claims the destination via claimAsset and returns the claim tx", async () => {
        const result = await executeReverseSwap(evmArgs());

        expect(result).toEqual({
            claimTransactionId: "0xclaimtx",
            receiveAmount: 99_000n,
        });
        expect(claimReverseUtxoMock).not.toHaveBeenCalled();
        expect(claimAssetMock).toHaveBeenCalledTimes(1);
        expect(claimAssetMock).toHaveBeenCalledWith(
            expect.objectContaining({
                asset: "TBTC",
                preimage: "0xpre",
                amount: 100_000,
                claimAddress: getAddress(CLAIM),
                refundAddress: getAddress(REFUND),
                timeoutBlockHeight: 222,
                destination: getAddress(CLAIM),
            }),
        );
    });

    test("forwards an ERC20 claim to a distinct destination", async () => {
        await executeReverseSwap(evmArgs({ destination: DESTINATION }));

        expect(claimAssetMock).toHaveBeenCalledWith(
            expect.objectContaining({
                claimAddress: getAddress(CLAIM),
                destination: getAddress(DESTINATION),
            }),
        );
    });

    test("requires a signer", async () => {
        await expect(
            executeReverseSwap(evmArgs({ signer: undefined })),
        ).rejects.toThrow(/requires a signer/);
        expect(claimAssetMock).not.toHaveBeenCalled();
    });

    test("throws when the created response lacks a refundAddress", async () => {
        await expect(
            executeReverseSwap(
                evmArgs({
                    createdSwap: {
                        ...createdReverseEvm,
                        refundAddress: undefined,
                    },
                }),
            ),
        ).rejects.toThrow(/missing a refundAddress/);
    });
});

describe("executeReverseSwap: UTXO destination", () => {
    test("claims via the reverse UTXO module and broadcasts the claim tx", async () => {
        const result = await executeReverseSwap(utxoArgs());

        expect(result).toEqual({
            claimTransactionId: "claim-txid",
            receiveAmount: 49_800n,
        });
        expect(claimReverseUtxoMock).toHaveBeenCalledTimes(1);
        expect(claimReverseUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "rev-utxo",
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

    test("requires claimKeys", async () => {
        await expect(
            executeReverseSwap(utxoArgs({ claimKeys: undefined })),
        ).rejects.toThrow(/requires claimKeys/);
        expect(claimReverseUtxoMock).not.toHaveBeenCalled();
    });

    test("throws when the created response lacks a refundPublicKey", async () => {
        await expect(
            executeReverseSwap(
                utxoArgs({
                    createdSwap: {
                        ...createdReverseUtxo,
                        refundPublicKey: undefined,
                    },
                }),
            ),
        ).rejects.toThrow(/missing a refundPublicKey/);
        expect(claimReverseUtxoMock).not.toHaveBeenCalled();
    });
});

describe("executeReverseSwap: destination validation", () => {
    test("rejects a distinct destination for a native-EVM asset", async () => {
        await expect(
            executeReverseSwap(
                evmArgs({ to: "RBTC", destination: DESTINATION }),
            ),
        ).rejects.toThrow(/destination must be omitted or equal/);
        expect(claimAssetMock).not.toHaveBeenCalled();
    });

    test("rejects a distinct destination for a UTXO asset", async () => {
        await expect(
            executeReverseSwap(utxoArgs({ destination: DESTINATION })),
        ).rejects.toThrow(/destination must be omitted or equal/);
        expect(claimReverseUtxoMock).not.toHaveBeenCalled();
    });

    test("allows a native-EVM destination equal to claimAddress", async () => {
        await executeReverseSwap(evmArgs({ to: "RBTC", destination: CLAIM }));
        expect(claimAssetMock).toHaveBeenCalledTimes(1);
    });

    test("allows a UTXO destination equal to claimAddress", async () => {
        await executeReverseSwap(utxoArgs({ destination: "bcrt1quser" }));
        expect(claimReverseUtxoMock).toHaveBeenCalledTimes(1);
    });
});

describe("executeReverseSwap: UTXO claim parameter forwarding", () => {
    test("falls back to the created swap's blindingKey when no override is given", async () => {
        await executeReverseSwap(
            utxoArgs({
                createdSwap: {
                    ...createdReverseUtxo,
                    blindingKey: "aa".repeat(32),
                },
            }),
        );
        expect(claimReverseUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({ blindingKey: "aa".repeat(32) }),
        );
    });

    test("prefers an explicit blindingKey over the created swap's", async () => {
        await executeReverseSwap(
            utxoArgs({
                blindingKey: "bb".repeat(32),
                createdSwap: {
                    ...createdReverseUtxo,
                    blindingKey: "aa".repeat(32),
                },
            }),
        );
        expect(claimReverseUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({ blindingKey: "bb".repeat(32) }),
        );
    });

    test("forwards the cooperative flag and the decoded preimage bytes", async () => {
        await executeReverseSwap(utxoArgs({ cooperative: false }));
        expect(claimReverseUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({
                cooperative: false,
                preimage: new Uint8Array(32).fill(0x11),
            }),
        );

        claimReverseUtxoMock.mockClear();
        await executeReverseSwap(utxoArgs({ cooperative: true }));
        expect(claimReverseUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({ cooperative: true }),
        );
    });
});

describe("executeReverseSwap: EVM claim parameters", () => {
    test("builds the swap contracts and passes the full gas-abstraction params", async () => {
        const signer = {} as never;
        await executeReverseSwap(evmArgs({ signer }));

        expect(buildSwapContractsForAssetMock).toHaveBeenCalledWith(
            "TBTC",
            signer,
        );
        expect(claimAssetMock).toHaveBeenCalledWith(
            expect.objectContaining({
                gasAbstraction: GasAbstractionType.Signer,
                getSigner: expect.any(Function),
                gasAbstractionSigner: signer,
                etherSwap: { address: "0xe" },
                erc20Swap: { address: "0xr" },
                sendTransaction: expect.any(Function),
            }),
        );
    });
});

describe("executeReverseSwap: failure propagation", () => {
    test("propagates a reverse lockup-transaction fetch failure (UTXO)", async () => {
        fetcherMock.mockImplementation(async (url: string) => {
            if (
                url.includes("/v2/swap/reverse/") &&
                url.endsWith("/transaction")
            ) {
                throw new Error("lockup tx unavailable");
            }
            return {};
        });

        await expect(executeReverseSwap(utxoArgs())).rejects.toThrow(
            /lockup tx unavailable/,
        );
        expect(claimReverseUtxoMock).not.toHaveBeenCalled();
    });

    test("propagates a broadcast failure after a successful claim (UTXO)", async () => {
        fetcherMock.mockImplementation(async (url: string) => {
            if (
                url.includes("/v2/swap/reverse/") &&
                url.endsWith("/transaction")
            ) {
                return {
                    id: "lock-id",
                    hex: "deadbeef",
                    timeoutBlockHeight: 100,
                };
            }
            if (url.includes("/v2/chain/") && url.endsWith("/transaction")) {
                throw new Error("broadcast rejected");
            }
            return {};
        });

        await expect(executeReverseSwap(utxoArgs())).rejects.toThrow(
            /broadcast rejected/,
        );
        expect(claimReverseUtxoMock).toHaveBeenCalledTimes(1);
    });

    test("propagates an EVM claim failure", async () => {
        claimAssetMock.mockRejectedValueOnce(new Error("claim reverted"));

        await expect(executeReverseSwap(evmArgs())).rejects.toThrow(
            /claim reverted/,
        );
    });
});
