import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as chain from "../../src/chain.ts";
import * as client from "../../src/client.ts";
import { DepositRefundableError } from "../../src/deposit/errors.ts";
import { DepositPhase, type DepositRecord } from "../../src/deposit/types.ts";
import * as resolveInvoiceMod from "../../src/resolveInvoice.ts";

vi.mock("../../src/client.ts", () => ({
    getPairs: vi.fn(async () => ({
        submarine: {
            USDC: {
                BTC: {
                    hash: "ph",
                    rate: 100_000,
                    limits: { minimal: 1, maximal: 1e12 },
                    fees: { minerFees: 100, percentage: 0.1 },
                },
            },
        },
        chain: {},
        reverse: {},
    })),
    createSubmarineSwap: vi.fn(async () => ({
        id: "sub1",
        expectedAmount: 500_000,
    })),
    createChainSwap: vi.fn(),
}));

vi.mock("../../src/resolveInvoice.ts", () => ({
    resolveInvoice: vi.fn(async () => ({
        invoice: "lnbcRESOLVED",
        type: "bolt11",
    })),
}));

vi.mock("../../src/invoice.ts", () => ({
    decodeInvoice: vi.fn(() => ({
        satoshis: 495_000,
        preimageHash: "bb",
        type: "bolt11",
    })),
    isInvoice: (s: string) => s.startsWith("lnbc"),
}));

vi.mock("../../src/chain.ts", () => ({ executeChainSwap: vi.fn() }));

// Import after mocks are registered.
const { createOutSwap, claimChainOut } =
    await import("../../src/deposit/swapOut.ts");

const resolveInvoice = vi.mocked(resolveInvoiceMod.resolveInvoice);
const createSubmarineSwap = vi.mocked(client.createSubmarineSwap);
const getPairs = vi.mocked(client.getPairs);
const createChainSwap = vi.mocked(client.createChainSwap);
const executeChainSwap = vi.mocked(chain.executeChainSwap);

const chainPairsMock = (
    limits: { minimal: number; maximal: number },
    rate = 1,
) =>
    ({
        submarine: {},
        chain: {
            USDC: {
                "L-BTC": {
                    hash: "chash",
                    rate,
                    limits,
                    fees: {
                        percentage: 0.1,
                        minerFees: {
                            server: 5,
                            user: { claim: 30, lockup: 0 },
                        },
                    },
                },
            },
        },
        reverse: {},
    }) as never;

describe("createOutSwap (Lightning)", () => {
    afterEach(() => vi.clearAllMocks());

    it("fetches an invoice sized to the locked amount, not a caller-supplied amount", async () => {
        const result = await createOutSwap({
            depositId: "d1",
            target: { type: "lightning", destination: "user@example.com" },
            mintedSats: 600_000,
            bridgeFee: 1000n,
        });

        // The SDK sizes the invoice from the locked budget (inverse fee model),
        // so it requests a positive amount derived from mintedSats — never 0 and
        // never a value the caller passed in.
        expect(resolveInvoice.mock.calls[0]?.[0]).toBe("user@example.com");
        expect(resolveInvoice.mock.calls[0]?.[1]).toBeGreaterThan(0);
        expect(createSubmarineSwap).toHaveBeenCalledWith(
            "USDC",
            "BTC",
            "lnbcRESOLVED",
            "ph",
        );
        expect(result.kind).toBe("submarine");
        expect(result.receiveAmountSats).toBe(495_000);
        // Honest lock amount: the commitment locks the full bridged budget
        // (mintedSats), not the swap's smaller expectedAmount (500_000).
        expect(result.lockAmountSats).toBe(600_000);
        expect(result.quote.lockAmountSats).toBe(600_000);
        expect(result.quote.receiveAmountSats).toBe(495_000);
        expect(result.quote.target).toBe("lightning");
    });

    it("rejects (refundably) an amount outside the submarine pair limits", async () => {
        getPairs.mockResolvedValueOnce({
            submarine: {
                USDC: {
                    BTC: {
                        hash: "ph",
                        rate: 100_000,
                        limits: { minimal: 100_000, maximal: 700_000 },
                        fees: { minerFees: 100, percentage: 0.1 },
                    },
                },
            },
            chain: {},
            reverse: {},
        } as never);
        await expect(
            createOutSwap({
                depositId: "d1",
                target: { type: "lightning", destination: "user@example.com" },
                mintedSats: 5_000_000,
                bridgeFee: 0n,
            }),
        ).rejects.toBeInstanceOf(DepositRefundableError);
        expect(resolveInvoice).not.toHaveBeenCalled();
        expect(createSubmarineSwap).not.toHaveBeenCalled();
    });

    it("rejects a pre-made fixed-amount invoice", async () => {
        await expect(
            createOutSwap({
                depositId: "d1",
                target: { type: "lightning", destination: "lnbc123" },
                mintedSats: 600_000,
                bridgeFee: 0n,
            }),
        ).rejects.toThrow(/fixed-amount Lightning invoice/);
        expect(resolveInvoice).not.toHaveBeenCalled();
        expect(createSubmarineSwap).not.toHaveBeenCalled();
    });

    it("throws when the deposit is too small to swap out after fees", async () => {
        await expect(
            createOutSwap({
                depositId: "d1",
                target: { type: "lightning", destination: "lnurl1xyz" },
                mintedSats: 50, // below the pair miner fee → nothing receivable
                bridgeFee: 0n,
            }),
        ).rejects.toThrow(/too small to swap out/);
        expect(resolveInvoice).not.toHaveBeenCalled();
    });

    it("throws when the resolved invoice exceeds the bridged budget", async () => {
        createSubmarineSwap.mockResolvedValueOnce({
            id: "sub1",
            expectedAmount: 2_000_000,
        } as never);
        await expect(
            createOutSwap({
                depositId: "d1",
                target: { type: "lightning", destination: "user@example.com" },
                mintedSats: 600_000,
                bridgeFee: 0n,
            }),
        ).rejects.toThrow(/only 600000 were bridged/);
    });
});

describe("createOutSwap (chain)", () => {
    afterEach(() => vi.clearAllMocks());

    it("locks the bridged amount and returns a claimable preimage", async () => {
        getPairs.mockResolvedValueOnce(
            chainPairsMock({ minimal: 1, maximal: 1e12 }),
        );
        createChainSwap.mockResolvedValueOnce({
            id: "chain1",
            claimDetails: { amount: 900, blindingKey: "bk" },
            lockupDetails: { amount: 990 },
        } as never);

        const result = await createOutSwap({
            depositId: "d1",
            target: { type: "chain", to: "L-BTC", address: "lq1addr" },
            mintedSats: 990,
            bridgeFee: 10_000n,
        });

        const call = createChainSwap.mock.calls[0]!;
        expect(call[0]).toBe("USDC");
        expect(call[1]).toBe("L-BTC");
        expect(call[2]).toBe(990);
        expect(call[5]).toBeUndefined();
        expect(call[6]).toBe("lq1addr");
        expect(call[7]).toBe("chash");

        expect(result.kind).toBe("chain");
        // The hash the server binds must be sha256 of the SDK-held preimage,
        // else the server lockup is unclaimable.
        expect(result.preimageHash).toBe(call[3]);
        expect(hex.encode(sha256(hex.decode(result.preimage!)))).toBe(
            result.preimageHash,
        );
        expect(result.blindingKey).toBe("bk");
        expect(result.lockAmountSats).toBe(990);
        expect(result.receiveAmountSats).toBe(870); // 900 gross − 30 claim fee
        expect(result.quote.target).toBe("chain");
        expect(result.quote.receiveAsset).toBe("L-BTC");
    });

    it("rejects amounts below or above the pair limits", async () => {
        getPairs.mockResolvedValueOnce(
            chainPairsMock({ minimal: 100, maximal: 1000 }),
        );
        await expect(
            createOutSwap({
                depositId: "d1",
                target: { type: "chain", to: "L-BTC", address: "lq1addr" },
                mintedSats: 50,
                bridgeFee: 0n,
            }),
        ).rejects.toThrow(/outside the USDC -> L-BTC limits/);

        getPairs.mockResolvedValueOnce(
            chainPairsMock({ minimal: 100, maximal: 1000 }),
        );
        await expect(
            createOutSwap({
                depositId: "d1",
                target: { type: "chain", to: "L-BTC", address: "lq1addr" },
                mintedSats: 5000,
                bridgeFee: 0n,
            }),
        ).rejects.toThrow(/outside the USDC -> L-BTC limits/);

        expect(createChainSwap).not.toHaveBeenCalled();
    });

    it("rejects when Boltz offers no chain pair for the target", async () => {
        await expect(
            createOutSwap({
                depositId: "d1",
                target: { type: "chain", to: "BTC", address: "bc1x" },
                mintedSats: 990,
                bridgeFee: 0n,
            }),
        ).rejects.toThrow(/Boltz offers no USDC -> BTC chain swap/);
        expect(createChainSwap).not.toHaveBeenCalled();
    });
});

const makeChainRecord = (
    overrides: Partial<DepositRecord> = {},
): DepositRecord => ({
    id: "d1",
    phase: DepositPhase.Settling,
    sourceAsset: "USDC-POL",
    address: "0xdeposit",
    index: 0,
    createdAt: 1,
    updatedAt: 1,
    amount: "1000000",
    txHash: "0xsrc",
    logIndex: 0,
    blockNumber: 1,
    swapKind: "chain",
    createdSwap: {
        id: "chain1",
        claimDetails: {},
        lockupDetails: {},
    } as never,
    target: { type: "chain", to: "L-BTC", address: "lq1addr" },
    preimage: "aa",
    claimPrivateKey: hex.encode(secp256k1.utils.randomSecretKey()),
    receiveAmountSats: 870,
    blindingKey: "bk",
    ...overrides,
});

describe("claimChainOut", () => {
    afterEach(() => vi.clearAllMocks());

    it("derives the claim pubkey and executes the UTXO claim", async () => {
        executeChainSwap.mockResolvedValueOnce({
            claimTransactionId: "0xtx",
        } as never);
        const record = makeChainRecord();

        const id = await claimChainOut(record);

        expect(id).toBe("0xtx");
        expect(executeChainSwap).toHaveBeenCalledTimes(1);
        const arg = executeChainSwap.mock.calls[0]![0] as never as {
            to: string;
            preimage: string;
            claimAddress: string;
            utxoClaim: {
                receiveAmount: number;
                blindingKey?: string;
                claimKeys: { publicKey: Uint8Array };
            };
        };
        expect(arg.to).toBe("L-BTC");
        expect(arg.preimage).toBe(record.preimage);
        expect(arg.claimAddress).toBe("lq1addr");
        expect(arg.utxoClaim.receiveAmount).toBe(870);
        expect(arg.utxoClaim.blindingKey).toBe("bk");
        expect(arg.utxoClaim.claimKeys.publicKey).toEqual(
            secp256k1.getPublicKey(hex.decode(record.claimPrivateKey!), true),
        );
    });

    it("rejects a non-chain swap kind", async () => {
        await expect(
            claimChainOut(makeChainRecord({ swapKind: "submarine" })),
        ).rejects.toThrow(/not a chain out-swap/);
        expect(executeChainSwap).not.toHaveBeenCalled();
    });

    it("rejects a missing chain target", async () => {
        await expect(
            claimChainOut(
                makeChainRecord({
                    target: { type: "lightning", destination: "x" },
                }),
            ),
        ).rejects.toThrow(/missing a chain target/);
        expect(executeChainSwap).not.toHaveBeenCalled();
    });

    it("rejects missing claim material", async () => {
        await expect(
            claimChainOut(makeChainRecord({ claimPrivateKey: undefined })),
        ).rejects.toThrow(/missing chain claim material/);
        expect(executeChainSwap).not.toHaveBeenCalled();
    });
});

describe("estimateSubmarineReceiveSats math", () => {
    afterEach(() => vi.clearAllMocks());

    it("sizes the invoice by the inverse fee model", async () => {
        // Default pair: rate 100000, minerFees 100, percentage 0.1.
        await createOutSwap({
            depositId: "d1",
            target: { type: "lightning", destination: "user@x" },
            mintedSats: 600_000,
            bridgeFee: 0n,
        });
        expect(resolveInvoice.mock.calls[0]![1]).toBe(
            Math.floor(((600_000 - 100) / (100_000 * 1.001)) * 0.995),
        );
    });

    it("falls back to rate=1 when the pair rate is non-positive", async () => {
        getPairs.mockResolvedValueOnce({
            submarine: {
                USDC: {
                    BTC: {
                        hash: "ph",
                        rate: 0,
                        limits: { minimal: 1, maximal: 1e12 },
                        fees: { minerFees: 100, percentage: 0.1 },
                    },
                },
            },
            chain: {},
            reverse: {},
        } as never);
        await createOutSwap({
            depositId: "d1",
            target: { type: "lightning", destination: "user@x" },
            mintedSats: 600_000,
            bridgeFee: 0n,
        });
        expect(resolveInvoice.mock.calls[0]![1]).toBe(
            Math.floor(((600_000 - 100) / (1 * 1.001)) * 0.995),
        );
    });
});
