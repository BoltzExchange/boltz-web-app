import { hex } from "@scure/base";
import type * as BoltzCoreModule from "boltz-core";

import type * as ClientModule from "../../src/client.ts";
import { type Logger, setLogger } from "../../src/logger.ts";
import {
    type ChainSwapUtxoClaimParams,
    type CooperativeSourceClaimInput,
    claimChainSwapUtxo,
    createCooperativeSourceClaimSignature,
} from "../../src/utxo/claim.ts";
import type * as MusigModule from "../../src/utxo/musig.ts";
import type * as TransactionModule from "../../src/utxo/transaction.ts";

const mocks = vi.hoisted(() => ({
    getChainSwapClaimDetails: vi.fn(),
    postChainSwapDetails: vi.fn(),
    createMusig: vi.fn(),
    tweakMusig: vi.fn(),
    hashForWitnessV1: vi.fn(),
    decodeAddress: vi.fn(),
    getConstructClaimTransaction: vi.fn(),
    getNetwork: vi.fn(),
    getOutputAmount: vi.fn(),
    getTransaction: vi.fn(),
    setCooperativeWitness: vi.fn(),
    txToHex: vi.fn(),
    txToId: vi.fn(),
    utxoSecpGet: vi.fn(),
    detectSwap: vi.fn(),
    deserializeSwapTree: vi.fn(),
}));

vi.mock("../../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    getChainSwapClaimDetails: mocks.getChainSwapClaimDetails,
    postChainSwapDetails: mocks.postChainSwapDetails,
}));

vi.mock("../../src/utxo/musig.ts", async (importActual) => ({
    ...(await importActual<typeof MusigModule>()),
    createMusig: mocks.createMusig,
    tweakMusig: mocks.tweakMusig,
    hashForWitnessV1: mocks.hashForWitnessV1,
}));

vi.mock("../../src/utxo/transaction.ts", async (importActual) => ({
    ...(await importActual<typeof TransactionModule>()),
    decodeAddress: mocks.decodeAddress,
    getConstructClaimTransaction: mocks.getConstructClaimTransaction,
    getNetwork: mocks.getNetwork,
    getOutputAmount: mocks.getOutputAmount,
    getTransaction: mocks.getTransaction,
    setCooperativeWitness: mocks.setCooperativeWitness,
    txToHex: mocks.txToHex,
    txToId: mocks.txToId,
}));

vi.mock("../../src/utxo/lazy.ts", () => ({
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

const SERVER_PUBLIC_KEY = "02ab";
const SOURCE_SERVER_PUBLIC_KEY = "03cd";
const PREIMAGE = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const PREIMAGE_HEX = hex.encode(PREIMAGE);

type MusigStub = Record<string, unknown>;

const makeMusigStub = (): MusigStub => {
    const stub: Record<string, unknown> = {
        aggPubkey: new Uint8Array([0x99]),
        publicNonce: new Uint8Array([0x01, 0x02]),
        ourPartialSignature: new Uint8Array([0x03, 0x04]),
        message: vi.fn(() => stub),
        generateNonce: vi.fn(() => stub),
        aggregateNonces: vi.fn(() => stub),
        initializeSession: vi.fn(() => stub),
        addPartial: vi.fn(() => stub),
        signPartial: vi.fn(() => stub),
        aggregatePartials: vi.fn(() => new Uint8Array([0xaa, 0xbb])),
    };
    return stub;
};

const deserializedTree = { tree: { stub: true } } as never;

const swapOutput = { vout: 0, type: 3, script: new Uint8Array([0x51]) };

let destMusig: MusigStub;
let tweakedMusig: MusigStub;
let constructClaimTransaction: ReturnType<typeof vi.fn>;
let claimTx: { id: string; hex: string };
let logger: Logger;

const baseParams = (
    overrides: Partial<ChainSwapUtxoClaimParams> = {},
): ChainSwapUtxoClaimParams => ({
    id: "chain-1",
    asset: "BTC",
    network: "regtest",
    serverPublicKey: SERVER_PUBLIC_KEY,
    swapTree: {} as never,
    claimKeys: {
        privateKey: new Uint8Array(32).fill(1),
        publicKey: new Uint8Array(33).fill(2),
    },
    preimage: PREIMAGE,
    claimAddress: "bcrt1quser",
    receiveAmount: 50_000,
    lockupTxHex: "deadbeef",
    ...overrides,
});

const cooperativeSourceInput = (): CooperativeSourceClaimInput => ({
    asset: "BTC",
    refundKeys: {
        privateKey: new Uint8Array(32).fill(5),
        publicKey: new Uint8Array(33).fill(6),
    },
    sourceSwapTree: {} as never,
});

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());

    destMusig = makeMusigStub();
    tweakedMusig = makeMusigStub();
    claimTx = { id: "raw-id", hex: "rawhex" };

    mocks.createMusig.mockReturnValue(destMusig);
    mocks.tweakMusig.mockReturnValue(tweakedMusig);

    mocks.deserializeSwapTree.mockReturnValue(deserializedTree);

    mocks.detectSwap.mockReturnValue(swapOutput);

    mocks.getTransaction.mockReturnValue({
        fromHex: vi.fn(() => ({ kind: "lockupTx" })),
    });
    mocks.getNetwork.mockReturnValue({ name: "regtest-network" });
    mocks.getOutputAmount.mockResolvedValue(60_000);
    mocks.decodeAddress.mockReturnValue({
        script: new Uint8Array([0x76, 0xa9]),
        blindingKey: undefined,
    });

    constructClaimTransaction = vi.fn(() => claimTx);
    mocks.getConstructClaimTransaction.mockReturnValue(
        constructClaimTransaction,
    );

    mocks.txToHex.mockImplementation((tx: unknown) =>
        tx === claimTx ? "cohex" : "othertxhex",
    );
    mocks.txToId.mockImplementation((tx: unknown) =>
        tx === claimTx ? "coid" : "othertxid",
    );

    mocks.hashForWitnessV1.mockReturnValue(new Uint8Array([0x77]));

    mocks.postChainSwapDetails.mockResolvedValue({
        pubNonce: "0a0b",
        partialSignature: "0c0d",
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

describe("claimChainSwapUtxo cooperative happy path", () => {
    test("posts claim details, aggregates the server partial, sets the cooperative witness and returns the cohex/coid", async () => {
        const result = await claimChainSwapUtxo(baseParams());

        expect(mocks.postChainSwapDetails).toHaveBeenCalledTimes(1);
        expect(mocks.postChainSwapDetails).toHaveBeenCalledWith(
            "chain-1",
            PREIMAGE_HEX,
            undefined,
            {
                index: 0,
                transaction: "cohex",
                pubNonce: hex.encode(tweakedMusig.publicNonce as Uint8Array),
            },
        );

        const boltzPublicKey = hex.decode(SERVER_PUBLIC_KEY);
        expect(tweakedMusig.aggregateNonces).toHaveBeenCalledTimes(1);
        const noncesArg = (
            tweakedMusig.aggregateNonces as ReturnType<typeof vi.fn>
        ).mock.calls[0][0];
        expect(noncesArg).toHaveLength(1);
        expect(noncesArg[0][0]).toEqual(boltzPublicKey);
        expect(noncesArg[0][1]).toEqual(hex.decode("0a0b"));

        expect(tweakedMusig.addPartial).toHaveBeenCalledTimes(1);
        expect(tweakedMusig.addPartial).toHaveBeenCalledWith(
            boltzPublicKey,
            hex.decode("0c0d"),
        );

        expect(tweakedMusig.signPartial).toHaveBeenCalledTimes(1);
        expect(tweakedMusig.aggregatePartials).toHaveBeenCalledTimes(1);

        expect(mocks.setCooperativeWitness).toHaveBeenCalledTimes(1);
        expect(mocks.setCooperativeWitness).toHaveBeenCalledWith(
            claimTx,
            0,
            new Uint8Array([0xaa, 0xbb]),
        );

        expect(result).toEqual({
            transactionHex: "cohex",
            transactionId: "coid",
        });
    });

    test("throwing when detectSwap finds an output uses the tweaked aggPubkey", async () => {
        await claimChainSwapUtxo(baseParams());
        expect(mocks.detectSwap).toHaveBeenCalledWith(tweakedMusig.aggPubkey, {
            kind: "lockupTx",
        });
    });
});

describe("cooperativeSource forwarding", () => {
    test("forwards the helper signature as the 3rd postChainSwapDetails argument when cooperativeSource is defined", async () => {
        mocks.getChainSwapClaimDetails.mockResolvedValue({
            publicKey: SOURCE_SERVER_PUBLIC_KEY,
            transactionHash: "ab12",
            pubNonce: "cd34",
        });

        await claimChainSwapUtxo(
            baseParams({ cooperativeSource: cooperativeSourceInput() }),
        );

        expect(mocks.getChainSwapClaimDetails).toHaveBeenCalledTimes(1);
        expect(mocks.getChainSwapClaimDetails).toHaveBeenCalledWith("chain-1");

        const expectedTheirSig = {
            pubNonce: hex.encode(tweakedMusig.publicNonce as Uint8Array),
            partialSignature: hex.encode(
                tweakedMusig.ourPartialSignature as Uint8Array,
            ),
        };

        expect(mocks.postChainSwapDetails).toHaveBeenCalledTimes(1);
        const postArgs = mocks.postChainSwapDetails.mock.calls[0];
        expect(postArgs[0]).toBe("chain-1");
        expect(postArgs[1]).toBe(PREIMAGE_HEX);
        expect(postArgs[2]).toEqual(expectedTheirSig);
    });

    test("passes undefined as the 3rd argument and never queries claim details when cooperativeSource is omitted", async () => {
        await claimChainSwapUtxo(baseParams());

        expect(mocks.getChainSwapClaimDetails).not.toHaveBeenCalled();
        expect(mocks.postChainSwapDetails.mock.calls[0][2]).toBeUndefined();
    });
});

describe("createCooperativeSourceClaimSignature eligibility", () => {
    test("returns undefined and debug-logs when the swap is not eligible for a cooperative claim", async () => {
        mocks.getChainSwapClaimDetails.mockRejectedValue(
            new Error("swap not eligible for a cooperative claim"),
        );

        const result = await createCooperativeSourceClaimSignature(
            "chain-1",
            cooperativeSourceInput(),
        );

        expect(result).toBeUndefined();
        expect(logger.debug).toHaveBeenCalledTimes(1);
        expect(
            (logger.debug as ReturnType<typeof vi.fn>).mock.calls[0][0],
        ).toContain("chain-1");
    });

    test("inside claimChainSwapUtxo an ineligible source claim leaves the 3rd argument undefined and the destination claim still proceeds", async () => {
        mocks.getChainSwapClaimDetails.mockRejectedValue(
            new Error("swap not eligible for a cooperative claim"),
        );

        const result = await claimChainSwapUtxo(
            baseParams({ cooperativeSource: cooperativeSourceInput() }),
        );

        expect(mocks.postChainSwapDetails).toHaveBeenCalledTimes(1);
        expect(mocks.postChainSwapDetails.mock.calls[0][2]).toBeUndefined();
        expect(mocks.setCooperativeWitness).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            transactionHex: "cohex",
            transactionId: "coid",
        });
    });

    test("rethrows any other error (network down)", async () => {
        mocks.getChainSwapClaimDetails.mockRejectedValue(
            new Error("network down"),
        );

        await expect(
            createCooperativeSourceClaimSignature(
                "chain-1",
                cooperativeSourceInput(),
            ),
        ).rejects.toThrow(/network down/);
        expect(logger.debug).not.toHaveBeenCalled();
    });

    test("a non-eligibility rejection bubbles into the cooperative catch and triggers the uncooperative fallback", async () => {
        mocks.getChainSwapClaimDetails.mockRejectedValue(
            new Error("network down"),
        );

        const result = await claimChainSwapUtxo(
            baseParams({ cooperativeSource: cooperativeSourceInput() }),
        );

        expect(mocks.postChainSwapDetails).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(mocks.setCooperativeWitness).not.toHaveBeenCalled();
        expect(result).toEqual({
            transactionHex: "cohex",
            transactionId: "coid",
        });
    });
});

describe("uncooperative fallback", () => {
    test("a postChainSwapDetails rejection warn-logs and recurses into the non-cooperative branch", async () => {
        const postError = new Error("post failed");
        mocks.postChainSwapDetails.mockRejectedValueOnce(postError);

        const result = await claimChainSwapUtxo(baseParams());

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            "Uncooperative Taproot claim because",
            postError,
        );

        expect(mocks.postChainSwapDetails).toHaveBeenCalledTimes(1);
        expect(mocks.setCooperativeWitness).not.toHaveBeenCalled();

        expect(constructClaimTransaction).toHaveBeenCalledTimes(2);

        expect(result).toEqual({
            transactionHex: "cohex",
            transactionId: "coid",
        });
    });
});

describe("non-cooperative branch", () => {
    test("returns immediately without any cooperative signing work when cooperative is false", async () => {
        const result = await claimChainSwapUtxo(
            baseParams({ cooperative: false }),
        );

        expect(mocks.getChainSwapClaimDetails).not.toHaveBeenCalled();
        expect(mocks.postChainSwapDetails).not.toHaveBeenCalled();
        expect(mocks.hashForWitnessV1).not.toHaveBeenCalled();
        expect(mocks.setCooperativeWitness).not.toHaveBeenCalled();
        expect(result).toEqual({
            transactionHex: "cohex",
            transactionId: "coid",
        });
    });
});

describe("missing swap output guard", () => {
    test("throws when detectSwap returns undefined and never reaches the construct claim transaction", async () => {
        mocks.detectSwap.mockReturnValue(undefined);

        await expect(claimChainSwapUtxo(baseParams())).rejects.toThrow(
            /could not find swap output/,
        );
        expect(constructClaimTransaction).not.toHaveBeenCalled();
    });
});

describe("createAdjustedClaim amount math and zero guard", () => {
    test("throws when receiveAmount is zero", async () => {
        await expect(
            claimChainSwapUtxo(
                baseParams({ cooperative: false, receiveAmount: 0 }),
            ),
        ).rejects.toThrow(/amount to be received is 0/);
    });

    test("forwards feeBudget = floor(inputSum - receiveAmount) with subtractFees true", async () => {
        mocks.getOutputAmount.mockResolvedValue(60_000);

        await claimChainSwapUtxo(
            baseParams({ cooperative: false, receiveAmount: 50_000 }),
        );

        expect(constructClaimTransaction).toHaveBeenCalledTimes(1);
        const [details, script, feeBudget, isRbf, liquidNetwork, blindingKey] =
            constructClaimTransaction.mock.calls[0];
        expect(details).toHaveLength(1);
        expect(script).toEqual(new Uint8Array([0x76, 0xa9]));
        expect(feeBudget).toBe(10_000);
        expect(isRbf).toBe(true);
        expect(liquidNetwork).toBeUndefined();
        expect(blindingKey).toBeUndefined();
    });

    test("rejects a negative feeBudget instead of constructing the claim", async () => {
        mocks.getOutputAmount.mockResolvedValue(40_000);

        await expect(
            claimChainSwapUtxo(
                baseParams({ cooperative: false, receiveAmount: 50_000 }),
            ),
        ).rejects.toThrow(
            /receiveAmount 50000 exceeds available input sum 40000/,
        );
        expect(constructClaimTransaction).not.toHaveBeenCalled();
    });
});

describe("L-BTC specific paths", () => {
    test("converts the blinding key to a Buffer, awaits secp init, and forwards the liquid network and decoded blinding key", async () => {
        const decodedBlindingKey = Buffer.from("aabbcc", "hex");
        mocks.decodeAddress.mockReturnValue({
            script: new Uint8Array([0x00, 0x14]),
            blindingKey: decodedBlindingKey,
        });
        const liquidNetwork = { name: "liquidregtest" };
        mocks.getNetwork.mockReturnValue(liquidNetwork);

        await claimChainSwapUtxo(
            baseParams({
                asset: "L-BTC",
                cooperative: false,
                blindingKey: "ffeedd",
            }),
        );

        expect(mocks.utxoSecpGet).toHaveBeenCalledTimes(1);

        const details = constructClaimTransaction.mock.calls[0][0];
        expect(details[0].blindingPrivateKey).toEqual(
            Buffer.from("ffeedd", "hex"),
        );

        expect(constructClaimTransaction.mock.calls[0][4]).toBe(liquidNetwork);
        expect(constructClaimTransaction.mock.calls[0][5]).toBe(
            decodedBlindingKey,
        );
    });

    test("BTC asset skips secp init and leaves blindingPrivateKey and liquid network undefined", async () => {
        await claimChainSwapUtxo(
            baseParams({ asset: "BTC", cooperative: false }),
        );

        expect(mocks.utxoSecpGet).not.toHaveBeenCalled();
        const details = constructClaimTransaction.mock.calls[0][0];
        expect(details[0].blindingPrivateKey).toBeUndefined();
        expect(constructClaimTransaction.mock.calls[0][4]).toBeUndefined();
    });
});

describe("MuSig key ordering and preimage encoding", () => {
    test("passes the hex-encoded preimage and pins server-first ordering with hex-decoded server values", async () => {
        await claimChainSwapUtxo(baseParams());

        const boltzPublicKey = hex.decode(SERVER_PUBLIC_KEY);

        expect(mocks.postChainSwapDetails.mock.calls[0][1]).toBe(PREIMAGE_HEX);

        const noncesArg = (
            tweakedMusig.aggregateNonces as ReturnType<typeof vi.fn>
        ).mock.calls[0][0];
        expect(noncesArg[0][0]).toEqual(boltzPublicKey);
        expect(noncesArg[0][1]).toEqual(hex.decode("0a0b"));

        expect(tweakedMusig.addPartial).toHaveBeenCalledWith(
            boltzPublicKey,
            hex.decode("0c0d"),
        );

        expect(mocks.createMusig).toHaveBeenCalledWith(
            expect.objectContaining({
                privateKey: expect.any(Uint8Array),
                publicKey: expect.any(Uint8Array),
            }),
            boltzPublicKey,
        );
    });
});
