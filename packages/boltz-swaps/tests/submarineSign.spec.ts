import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import type * as BoltzCoreModule from "boltz-core";
import { signSubmarineClaim } from "boltz-swaps";

import type * as ClientModule from "../src/client.ts";
import type * as InvoiceModule from "../src/invoice.ts";
import type * as MusigModule from "../src/utxo/musig.ts";

const mocks = vi.hoisted(() => ({
    getSubmarineClaimDetails: vi.fn(),
    postSubmarineClaimDetails: vi.fn(),
    createMusig: vi.fn(),
    tweakMusig: vi.fn(),
    deserializeSwapTree: vi.fn(),
    decodeInvoice: vi.fn(),
}));

vi.mock("../src/invoice.ts", async (importActual) => ({
    ...(await importActual<typeof InvoiceModule>()),
    decodeInvoice: mocks.decodeInvoice,
}));

vi.mock("../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    getSubmarineClaimDetails: mocks.getSubmarineClaimDetails,
    postSubmarineClaimDetails: mocks.postSubmarineClaimDetails,
}));

vi.mock("../src/utxo/musig.ts", async (importActual) => ({
    ...(await importActual<typeof MusigModule>()),
    createMusig: mocks.createMusig,
    tweakMusig: mocks.tweakMusig,
}));

vi.mock("boltz-core", async (importActual) => {
    const actual = await importActual<typeof BoltzCoreModule>();
    return {
        ...actual,
        SwapTreeSerializer: {
            ...actual.SwapTreeSerializer,
            deserializeSwapTree: mocks.deserializeSwapTree,
        },
    };
});

const CLAIM_PUBLIC_KEY = "02ab";
const PREIMAGE = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const PREIMAGE_HASH = hex.encode(sha256(PREIMAGE));
const TRANSACTION_HASH = new Uint8Array([0x77]);
const SERVER_PUB_NONCE = new Uint8Array([0x88]);

const makeMusigStub = () => {
    const stub: Record<string, unknown> = {
        aggPubkey: new Uint8Array([0x99]),
        publicNonce: new Uint8Array([0x01, 0x02]),
        ourPartialSignature: new Uint8Array([0x03, 0x04]),
        message: vi.fn(() => stub),
        generateNonce: vi.fn(() => stub),
        aggregateNonces: vi.fn(() => stub),
        initializeSession: vi.fn(() => stub),
        signPartial: vi.fn(() => stub),
    };
    return stub;
};

let tweaked: ReturnType<typeof makeMusigStub>;

const baseArgs = () => ({
    id: "sub-1",
    asset: "BTC" as const,
    swapTree: {} as never,
    claimPublicKey: CLAIM_PUBLIC_KEY,
    refundKeys: {
        privateKey: new Uint8Array(32).fill(1),
        publicKey: new Uint8Array(33).fill(2),
    },
    invoice: "lnbcrt1example",
});

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    tweaked = makeMusigStub();
    mocks.createMusig.mockReturnValue({ aggPubkey: new Uint8Array([0x55]) });
    mocks.tweakMusig.mockReturnValue(tweaked);
    mocks.deserializeSwapTree.mockReturnValue({ tree: { stub: true } });
    mocks.decodeInvoice.mockReturnValue({
        type: "bolt11",
        satoshis: 1,
        preimageHash: PREIMAGE_HASH,
    });
    mocks.getSubmarineClaimDetails.mockResolvedValue({
        pubNonce: SERVER_PUB_NONCE,
        preimage: PREIMAGE,
        transactionHash: TRANSACTION_HASH,
    });
    mocks.postSubmarineClaimDetails.mockResolvedValue(undefined);
});

describe("signSubmarineClaim", () => {
    test("posts the user's partial signature when the preimage matches", async () => {
        await signSubmarineClaim(baseArgs());

        const boltzPublicKey = hex.decode(CLAIM_PUBLIC_KEY);
        expect(mocks.createMusig).toHaveBeenCalledWith(
            expect.objectContaining({
                privateKey: expect.any(Uint8Array),
                publicKey: expect.any(Uint8Array),
            }),
            boltzPublicKey,
        );
        expect(tweaked.message).toHaveBeenCalledWith(TRANSACTION_HASH);

        const noncesArg = (tweaked.aggregateNonces as ReturnType<typeof vi.fn>)
            .mock.calls[0][0];
        expect(noncesArg[0][0]).toEqual(boltzPublicKey);
        expect(noncesArg[0][1]).toEqual(SERVER_PUB_NONCE);

        expect(mocks.postSubmarineClaimDetails).toHaveBeenCalledTimes(1);
        expect(mocks.postSubmarineClaimDetails).toHaveBeenCalledWith(
            "sub-1",
            tweaked.publicNonce,
            tweaked.ourPartialSignature,
        );
    });

    test("throws and never posts when the revealed preimage does not match", async () => {
        mocks.decodeInvoice.mockReturnValue({
            type: "bolt11",
            satoshis: 1,
            preimageHash: "00".repeat(32),
        });

        await expect(signSubmarineClaim(baseArgs())).rejects.toThrow(
            /invalid preimage/,
        );

        expect(mocks.createMusig).not.toHaveBeenCalled();
        expect(mocks.postSubmarineClaimDetails).not.toHaveBeenCalled();
    });
});

describe("signSubmarineClaim error propagation", () => {
    test("rejects without fetching claim details when the invoice cannot be decoded", async () => {
        mocks.decodeInvoice.mockImplementationOnce(() => {
            throw new Error("invalid invoice");
        });

        await expect(signSubmarineClaim(baseArgs())).rejects.toThrow(
            /invalid invoice/,
        );
        expect(mocks.getSubmarineClaimDetails).not.toHaveBeenCalled();
        expect(mocks.postSubmarineClaimDetails).not.toHaveBeenCalled();
    });

    test("propagates a claim-details failure without signing", async () => {
        mocks.getSubmarineClaimDetails.mockRejectedValueOnce(
            new Error("details unavailable"),
        );

        await expect(signSubmarineClaim(baseArgs())).rejects.toThrow(
            /details unavailable/,
        );
        expect(mocks.createMusig).not.toHaveBeenCalled();
        expect(mocks.postSubmarineClaimDetails).not.toHaveBeenCalled();
    });

    test("propagates a musig failure without posting", async () => {
        mocks.tweakMusig.mockImplementationOnce(() => {
            throw new Error("tweak failed");
        });

        await expect(signSubmarineClaim(baseArgs())).rejects.toThrow(
            /tweak failed/,
        );
        expect(mocks.postSubmarineClaimDetails).not.toHaveBeenCalled();
    });

    test("propagates a failure to post the partial signature", async () => {
        mocks.postSubmarineClaimDetails.mockRejectedValueOnce(
            new Error("post failed"),
        );

        await expect(signSubmarineClaim(baseArgs())).rejects.toThrow(
            /post failed/,
        );
        expect(mocks.createMusig).toHaveBeenCalledTimes(1);
    });
});
