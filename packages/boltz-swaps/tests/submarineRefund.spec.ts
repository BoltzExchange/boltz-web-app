import { hex } from "@scure/base";
import type * as BoltzCoreModule from "boltz-core";
import { OutputType } from "boltz-core";
import { SwapType } from "boltz-swaps";
import { Buffer } from "buffer";

import type * as ClientModule from "../src/client.ts";
import { type Logger, setLogger } from "../src/logger.ts";
import type * as MusigModule from "../src/utxo/musig.ts";
import { refundSubmarineUtxo } from "../src/utxo/refund.ts";
import type * as TransactionModule from "../src/utxo/transaction.ts";

const mocks = vi.hoisted(() => ({
    getPartialRefundSignature: vi.fn(),
    createMusig: vi.fn(),
    tweakMusig: vi.fn(),
    hashForWitnessV1: vi.fn(),
    decodeAddress: vi.fn(),
    getConstructRefundTransaction: vi.fn(),
    getNetwork: vi.fn(),
    getTransaction: vi.fn(),
    setCooperativeWitness: vi.fn(),
    txToHex: vi.fn(),
    txToId: vi.fn(),
    utxoSecpGet: vi.fn(),
    detectSwap: vi.fn(),
    deserializeSwapTree: vi.fn(),
}));

vi.mock("../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    getPartialRefundSignature: mocks.getPartialRefundSignature,
}));

vi.mock("../src/utxo/musig.ts", async (importActual) => ({
    ...(await importActual<typeof MusigModule>()),
    createMusig: mocks.createMusig,
    tweakMusig: mocks.tweakMusig,
    hashForWitnessV1: mocks.hashForWitnessV1,
}));

vi.mock("../src/utxo/transaction.ts", async (importActual) => ({
    ...(await importActual<typeof TransactionModule>()),
    decodeAddress: mocks.decodeAddress,
    getConstructRefundTransaction: mocks.getConstructRefundTransaction,
    getNetwork: mocks.getNetwork,
    getTransaction: mocks.getTransaction,
    setCooperativeWitness: mocks.setCooperativeWitness,
    txToHex: mocks.txToHex,
    txToId: mocks.txToId,
}));

vi.mock("../src/utxo/lazy.ts", () => ({
    utxoSecp: { get: mocks.utxoSecpGet },
}));

vi.mock("boltz-core", async (importActual) => {
    const actual = await importActual<typeof BoltzCoreModule>();
    return {
        ...actual,
        detectSwap: mocks.detectSwap,
        SwapTreeSerializer: {
            ...actual.SwapTreeSerializer,
            deserializeSwapTree: mocks.deserializeSwapTree,
        },
    };
});

const CLAIM_PUBLIC_KEY = "02ab";

const makeMusigStub = () => {
    const stub: Record<string, unknown> = {
        aggPubkey: new Uint8Array([0x99]),
        publicNonce: new Uint8Array([0x01, 0x02]),
        message: vi.fn(() => stub),
        generateNonce: vi.fn(() => stub),
        aggregateNonces: vi.fn(() => stub),
        initializeSession: vi.fn(() => stub),
        signPartial: vi.fn(() => stub),
        addPartial: vi.fn(() => stub),
        aggregatePartials: vi.fn(() => new Uint8Array([0xaa, 0xbb])),
    };
    return stub;
};

let tweaked: ReturnType<typeof makeMusigStub>;
let constructRefund: ReturnType<typeof vi.fn>;
let refundTx: { id: string };
let logger: Logger;

const baseParams = (
    overrides: Partial<Parameters<typeof refundSubmarineUtxo>[0]> = {},
): Parameters<typeof refundSubmarineUtxo>[0] => ({
    id: "refund-1",
    asset: "BTC",
    network: "regtest",
    swapTree: {} as never,
    claimPublicKey: CLAIM_PUBLIC_KEY,
    refundKeys: {
        privateKey: new Uint8Array(32).fill(1),
        publicKey: new Uint8Array(33).fill(2),
    },
    lockupTxHex: "deadbeef",
    refundAddress: "bcrt1quser",
    feePerVbyte: 2,
    timeoutBlockHeight: 150,
    ...overrides,
});

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());

    tweaked = makeMusigStub();
    refundTx = { id: "refund-tx" };

    mocks.createMusig.mockReturnValue({ aggPubkey: new Uint8Array([0x55]) });
    mocks.tweakMusig.mockReturnValue(tweaked);
    mocks.deserializeSwapTree.mockReturnValue({ tree: { stub: true } });
    mocks.detectSwap.mockReturnValue({
        vout: 0,
        type: 3,
        script: new Uint8Array([0x51]),
    });
    mocks.getTransaction.mockReturnValue({
        fromHex: vi.fn(() => ({ kind: "lockupTx" })),
    });
    mocks.getNetwork.mockReturnValue({ name: "regtest-network" });
    mocks.decodeAddress.mockReturnValue({
        script: new Uint8Array([0x76, 0xa9]),
        blindingKey: undefined,
    });
    constructRefund = vi.fn(() => refundTx);
    mocks.getConstructRefundTransaction.mockReturnValue(constructRefund);
    mocks.txToHex.mockReturnValue("refundhex");
    mocks.txToId.mockReturnValue("refundid");
    mocks.hashForWitnessV1.mockReturnValue(new Uint8Array([0x77]));
    mocks.getPartialRefundSignature.mockResolvedValue({
        pubNonce: new Uint8Array([0x0a, 0x0b]),
        signature: new Uint8Array([0x0c, 0x0d]),
    });
    mocks.utxoSecpGet.mockResolvedValue({ confidential: {} });

    logger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
    };
    setLogger(logger);
});

afterEach(() => {
    setLogger({
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        log: () => {},
    });
});

describe("refundSubmarineUtxo cooperative happy path", () => {
    test("requests the submarine refund signature, sets the witness and returns the tx", async () => {
        const result = await refundSubmarineUtxo(baseParams());

        expect(mocks.getPartialRefundSignature).toHaveBeenCalledTimes(1);
        const args = mocks.getPartialRefundSignature.mock.calls[0];
        expect(args[0]).toBe("refund-1");
        expect(args[1]).toBe(SwapType.Submarine);
        expect(args[2]).toEqual(tweaked.publicNonce);
        expect(args[3]).toBe("refundhex");
        expect(args[4]).toBe(0);

        const boltzPublicKey = hex.decode(CLAIM_PUBLIC_KEY);
        expect(tweaked.addPartial).toHaveBeenCalledWith(
            boltzPublicKey,
            new Uint8Array([0x0c, 0x0d]),
        );
        expect(mocks.setCooperativeWitness).toHaveBeenCalledWith(
            refundTx,
            0,
            new Uint8Array([0xaa, 0xbb]),
        );
        expect(constructRefund.mock.calls[0][2]).toBe(0);
        expect(result).toEqual({
            transactionHex: "refundhex",
            transactionId: "refundid",
        });
    });
});

describe("refundSubmarineUtxo uncooperative fallback", () => {
    test("falls back to a timelocked refund when the cooperative signature fails", async () => {
        mocks.getPartialRefundSignature.mockRejectedValueOnce(
            new Error("refund denied"),
        );

        const result = await refundSubmarineUtxo(baseParams());

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(mocks.setCooperativeWitness).not.toHaveBeenCalled();
        expect(constructRefund).toHaveBeenCalledTimes(2);
        expect(constructRefund.mock.calls[1][2]).toBe(150);
        expect(result).toEqual({
            transactionHex: "refundhex",
            transactionId: "refundid",
        });
    });
});

describe("refundSubmarineUtxo non-cooperative branch", () => {
    test("returns immediately without requesting a signature", async () => {
        const result = await refundSubmarineUtxo(
            baseParams({ cooperative: false }),
        );

        expect(mocks.getPartialRefundSignature).not.toHaveBeenCalled();
        expect(mocks.setCooperativeWitness).not.toHaveBeenCalled();
        expect(constructRefund.mock.calls[0][2]).toBe(150);
        expect(result).toEqual({
            transactionHex: "refundhex",
            transactionId: "refundid",
        });
    });
});

describe("refundSubmarineUtxo guards", () => {
    test("throws when the swap output cannot be located", async () => {
        mocks.detectSwap.mockReturnValue(undefined);

        await expect(refundSubmarineUtxo(baseParams())).rejects.toThrow(
            /could not find swap output/,
        );
        expect(constructRefund).not.toHaveBeenCalled();
    });

    test("L-BTC initializes secp before constructing", async () => {
        await refundSubmarineUtxo(baseParams({ asset: "L-BTC" }));
        expect(mocks.utxoSecpGet).toHaveBeenCalledTimes(1);
    });

    test("BTC skips secp init", async () => {
        await refundSubmarineUtxo(baseParams());
        expect(mocks.utxoSecpGet).not.toHaveBeenCalled();
    });
});

describe("refundSubmarineUtxo cooperative-chain failures fall back to a timelocked refund", () => {
    const saboteurs: [string, () => void][] = [
        [
            "hashForWitnessV1",
            () =>
                mocks.hashForWitnessV1.mockImplementationOnce(() => {
                    throw new Error("boom");
                }),
        ],
        [
            "generateNonce",
            () => {
                tweaked.generateNonce = vi.fn(() => {
                    throw new Error("boom");
                });
            },
        ],
        [
            "aggregateNonces",
            () => {
                tweaked.aggregateNonces = vi.fn(() => {
                    throw new Error("boom");
                });
            },
        ],
        [
            "initializeSession",
            () => {
                tweaked.initializeSession = vi.fn(() => {
                    throw new Error("boom");
                });
            },
        ],
        [
            "signPartial",
            () => {
                tweaked.signPartial = vi.fn(() => {
                    throw new Error("boom");
                });
            },
        ],
        [
            "addPartial",
            () => {
                tweaked.addPartial = vi.fn(() => {
                    throw new Error("boom");
                });
            },
        ],
        [
            "aggregatePartials",
            () => {
                tweaked.aggregatePartials = vi.fn(() => {
                    throw new Error("boom");
                });
            },
        ],
    ];

    test.each(saboteurs)(
        "falls back when %s throws",
        async (_name, sabotage) => {
            sabotage();

            const result = await refundSubmarineUtxo(baseParams());

            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(mocks.setCooperativeWitness).not.toHaveBeenCalled();
            expect(constructRefund).toHaveBeenCalledTimes(2);
            expect(constructRefund.mock.calls[1][2]).toBe(150);
            expect(result).toEqual({
                transactionHex: "refundhex",
                transactionId: "refundid",
            });
        },
    );
});

describe("refundSubmarineUtxo detail construction", () => {
    test("forwards taproot refund details and selects the BTC builder", async () => {
        await refundSubmarineUtxo(baseParams());

        expect(mocks.getConstructRefundTransaction).toHaveBeenCalledWith(
            "BTC",
            false,
        );

        const details = constructRefund.mock.calls[0][0];
        expect(details).toHaveLength(1);
        expect(details[0]).toMatchObject({
            cooperative: true,
            type: OutputType.Taproot,
            transactionId: "refundid",
        });
        expect(details[0].blindingPrivateKey).toBeUndefined();
        expect(constructRefund.mock.calls[0][5]).toBeUndefined();
        expect(constructRefund.mock.calls[0][6]).toBeUndefined();
    });

    test("selects the liquid builder and forwards the blinding key for L-BTC", async () => {
        await refundSubmarineUtxo(
            baseParams({ asset: "L-BTC", blindingKey: "aabb" }),
        );

        expect(mocks.getConstructRefundTransaction).toHaveBeenCalledWith(
            "L-BTC",
            true,
        );

        const details = constructRefund.mock.calls[0][0];
        expect(details[0].blindingPrivateKey).toEqual(
            Buffer.from("aabb", "hex"),
        );
        expect(constructRefund.mock.calls[0][5]).toEqual({
            name: "regtest-network",
        });
    });
});
