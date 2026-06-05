import { SigHash } from "@scure/btc-signer";
import { Musig, TaprootUtils } from "boltz-core";
import { TaprootUtils as LiquidTaprootUtils } from "boltz-core/liquid";

import {
    LBTC,
    createMusig,
    hashForWitnessV1,
    tweakMusig,
} from "../../src/utxo/musig.ts";

const musigSentinel = { tag: "musig" } as never;
const tweakSentinel = { tag: "tweaked" } as never;
const liquidHashSentinel = new Uint8Array([0xaa, 0xbb, 0xcc]);
const btcHashSentinel = new Uint8Array([0x11, 0x22, 0x33]);

afterEach(() => {
    vi.restoreAllMocks();
});

describe("createMusig", () => {
    test("forwards our private key first and orders public keys [their, ours]", () => {
        const createSpy = vi
            .spyOn(Musig, "create")
            .mockReturnValue(musigSentinel);

        const ourKeys = {
            privateKey: new Uint8Array(32).fill(1),
            publicKey: new Uint8Array(33).fill(2),
        };
        const theirPublicKey = new Uint8Array(33).fill(3);

        const result = createMusig(ourKeys, theirPublicKey);

        expect(result).toBe(musigSentinel);
        expect(createSpy).toHaveBeenCalledTimes(1);

        const [privateKeyArg, publicKeysArg] = createSpy.mock.calls[0];

        expect(privateKeyArg).toBeInstanceOf(Uint8Array);
        expect(Array.from(privateKeyArg as Uint8Array)).toEqual(
            Array.from(ourKeys.privateKey),
        );

        expect(publicKeysArg).toHaveLength(2);
        expect(Array.from(publicKeysArg[0] as Uint8Array)).toEqual(
            Array.from(theirPublicKey),
        );
        expect(Array.from(publicKeysArg[1] as Uint8Array)).toEqual(
            Array.from(ourKeys.publicKey),
        );
    });

    test("does NOT order the public keys as [ours, theirs] (ordering is load-bearing)", () => {
        const createSpy = vi
            .spyOn(Musig, "create")
            .mockReturnValue(musigSentinel);

        const ourKeys = {
            privateKey: new Uint8Array(32).fill(1),
            publicKey: new Uint8Array(33).fill(7),
        };
        const theirPublicKey = new Uint8Array(33).fill(9);

        createMusig(ourKeys, theirPublicKey);

        const [, publicKeysArg] = createSpy.mock.calls[0];

        expect(Array.from(publicKeysArg[0] as Uint8Array)).not.toEqual(
            Array.from(ourKeys.publicKey),
        );
        expect(Array.from(publicKeysArg[0] as Uint8Array)).toEqual(
            Array.from(theirPublicKey),
        );
    });

    test("defensively copies the private key (mutating input afterwards does not affect the captured arg)", () => {
        const createSpy = vi
            .spyOn(Musig, "create")
            .mockReturnValue(musigSentinel);

        const ourKeys = {
            privateKey: new Uint8Array(32).fill(1),
            publicKey: new Uint8Array(33).fill(2),
        };
        const theirPublicKey = new Uint8Array(33).fill(3);

        createMusig(ourKeys, theirPublicKey);

        const [privateKeyArg] = createSpy.mock.calls[0];

        expect(privateKeyArg).not.toBe(ourKeys.privateKey);

        ourKeys.privateKey.fill(0xff);
        expect(Array.from(privateKeyArg as Uint8Array)).toEqual(
            new Array(32).fill(1),
        );
    });

    test("defensively copies our public key (mutating input afterwards does not affect the captured arg)", () => {
        const createSpy = vi
            .spyOn(Musig, "create")
            .mockReturnValue(musigSentinel);

        const ourKeys = {
            privateKey: new Uint8Array(32).fill(1),
            publicKey: new Uint8Array(33).fill(2),
        };
        const theirPublicKey = new Uint8Array(33).fill(3);

        createMusig(ourKeys, theirPublicKey);

        const [, publicKeysArg] = createSpy.mock.calls[0];
        const capturedOurPublicKey = publicKeysArg[1] as Uint8Array;

        expect(capturedOurPublicKey).not.toBe(ourKeys.publicKey);

        ourKeys.publicKey.fill(0xff);
        expect(Array.from(capturedOurPublicKey)).toEqual(new Array(33).fill(2));
    });

    test("accepts Node Buffers / offset sub-views and copies them into plain Uint8Arrays", () => {
        const createSpy = vi
            .spyOn(Musig, "create")
            .mockReturnValue(musigSentinel);

        const privateKey = Buffer.alloc(32, 1);
        const backing = new Uint8Array(40).fill(0);
        backing.fill(2, 4, 37);
        const publicKey = backing.subarray(4, 37);
        expect(publicKey).toHaveLength(33);

        const theirPublicKey = new Uint8Array(33).fill(3);

        createMusig({ privateKey, publicKey }, theirPublicKey);

        const [privateKeyArg, publicKeysArg] = createSpy.mock.calls[0];

        expect(privateKeyArg).toBeInstanceOf(Uint8Array);
        expect(Array.from(privateKeyArg as Uint8Array)).toEqual(
            new Array(32).fill(1),
        );

        const capturedOurPublicKey = publicKeysArg[1] as Uint8Array;
        expect(capturedOurPublicKey).toBeInstanceOf(Uint8Array);
        expect(Array.from(capturedOurPublicKey)).toEqual(new Array(33).fill(2));

        backing.fill(0xff);
        expect(Array.from(capturedOurPublicKey)).toEqual(new Array(33).fill(2));
    });
});

describe("tweakMusig: asset dispatch", () => {
    const tree = { tag: "tree" } as never;

    test("L-BTC routes to the Liquid TaprootUtils.tweakMusig only", () => {
        const liquidSpy = vi
            .spyOn(LiquidTaprootUtils, "tweakMusig")
            .mockReturnValue(tweakSentinel);
        const btcSpy = vi
            .spyOn(TaprootUtils, "tweakMusig")
            .mockReturnValue("WRONG" as never);

        const result = tweakMusig(LBTC, musigSentinel, tree);

        expect(result).toBe(tweakSentinel);
        expect(liquidSpy).toHaveBeenCalledTimes(1);
        expect(liquidSpy).toHaveBeenCalledWith(musigSentinel, tree);
        expect(btcSpy).not.toHaveBeenCalled();
    });

    test("L-BTC constant equals the 'L-BTC' string", () => {
        expect(LBTC).toBe("L-BTC");
    });

    test("BTC routes to the (BTC) TaprootUtils.tweakMusig only", () => {
        const liquidSpy = vi
            .spyOn(LiquidTaprootUtils, "tweakMusig")
            .mockReturnValue("WRONG" as never);
        const btcSpy = vi
            .spyOn(TaprootUtils, "tweakMusig")
            .mockReturnValue(tweakSentinel);

        const result = tweakMusig("BTC", musigSentinel, tree);

        expect(result).toBe(tweakSentinel);
        expect(btcSpy).toHaveBeenCalledTimes(1);
        expect(btcSpy).toHaveBeenCalledWith(musigSentinel, tree);
        expect(liquidSpy).not.toHaveBeenCalled();
    });

    test("any non 'L-BTC' asset (e.g. RBTC) routes to the BTC TaprootUtils branch", () => {
        const liquidSpy = vi
            .spyOn(LiquidTaprootUtils, "tweakMusig")
            .mockReturnValue("WRONG" as never);
        const btcSpy = vi
            .spyOn(TaprootUtils, "tweakMusig")
            .mockReturnValue(tweakSentinel);

        const result = tweakMusig("RBTC", musigSentinel, tree);

        expect(result).toBe(tweakSentinel);
        expect(btcSpy).toHaveBeenCalledTimes(1);
        expect(btcSpy).toHaveBeenCalledWith(musigSentinel, tree);
        expect(liquidSpy).not.toHaveBeenCalled();
    });
});

describe("hashForWitnessV1: Liquid branch", () => {
    const liquidNetwork = { name: "liquid" } as never;
    const liquidTx = { tag: "liquid-tx" } as never;
    const liquidInputs = [
        {
            script: Buffer.from([0x51]),
            value: Buffer.from([0x01]),
            asset: Buffer.from([0x02]),
            nonce: Buffer.from([0x03]),
        },
    ] as never;
    const leafHash = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

    test("forwards (network, inputs, tx, index, leafHash) to LiquidTaprootUtils.hashForWitnessV1", () => {
        const liquidSpy = vi
            .spyOn(LiquidTaprootUtils, "hashForWitnessV1")
            .mockReturnValue(liquidHashSentinel as never);

        const result = hashForWitnessV1(
            LBTC,
            liquidNetwork,
            liquidInputs,
            liquidTx,
            2,
            leafHash,
        );

        expect(result).toBe(liquidHashSentinel);
        expect(liquidSpy).toHaveBeenCalledTimes(1);
        expect(liquidSpy).toHaveBeenCalledWith(
            liquidNetwork,
            liquidInputs,
            liquidTx,
            2,
            leafHash,
        );
    });

    test("forwards undefined leafHash when omitted (5th positional arg is undefined)", () => {
        const liquidSpy = vi
            .spyOn(LiquidTaprootUtils, "hashForWitnessV1")
            .mockReturnValue(liquidHashSentinel as never);

        hashForWitnessV1(LBTC, liquidNetwork, liquidInputs, liquidTx, 7);

        expect(liquidSpy).toHaveBeenCalledTimes(1);
        const callArgs = liquidSpy.mock.calls[0];
        expect(callArgs[3]).toBe(7);
        expect(callArgs[4]).toBeUndefined();
    });

    test("does not touch the tx (no preimageWitnessV1 call) on the Liquid branch", () => {
        vi.spyOn(LiquidTaprootUtils, "hashForWitnessV1").mockReturnValue(
            liquidHashSentinel as never,
        );
        const preimageWitnessV1 = vi.fn();

        hashForWitnessV1(
            LBTC,
            liquidNetwork,
            liquidInputs,
            { preimageWitnessV1 } as never,
            0,
        );

        expect(preimageWitnessV1).not.toHaveBeenCalled();
    });
});

describe("hashForWitnessV1: BTC branch", () => {
    const btcNetwork = { bech32: "bc" } as never;

    test("calls tx.preimageWitnessV1(index, scripts, SigHash.DEFAULT, amounts) and drops leafHash", () => {
        const liquidSpy = vi
            .spyOn(LiquidTaprootUtils, "hashForWitnessV1")
            .mockReturnValue("WRONG" as never);

        const s0 = new Uint8Array([0xa0]);
        const s1 = new Uint8Array([0xa1]);
        const preimageWitnessV1 = vi.fn().mockReturnValue(btcHashSentinel);
        const fakeTx = { preimageWitnessV1 } as never;
        const someLeafHash = Buffer.from([0x99]);

        const result = hashForWitnessV1(
            "BTC",
            btcNetwork,
            [
                { script: s0, amount: 100n },
                { script: s1, amount: 200n },
            ] as never,
            fakeTx,
            1,
            someLeafHash,
        );

        expect(result).toBe(btcHashSentinel);
        expect(liquidSpy).not.toHaveBeenCalled();
        expect(preimageWitnessV1).toHaveBeenCalledTimes(1);
        expect(preimageWitnessV1).toHaveBeenCalledWith(
            1,
            [s0, s1],
            SigHash.DEFAULT,
            [100n, 200n],
        );

        expect(preimageWitnessV1.mock.calls[0][2]).toBe(0);

        expect(preimageWitnessV1.mock.calls[0]).toHaveLength(4);
        expect(preimageWitnessV1.mock.calls[0]).not.toContain(someLeafHash);
    });

    test("scripts and amounts arrays stay element-wise aligned across the dual map (3 inputs)", () => {
        const s0 = new Uint8Array([0xb0]);
        const s1 = new Uint8Array([0xb1]);
        const s2 = new Uint8Array([0xb2]);
        const preimageWitnessV1 = vi.fn().mockReturnValue(btcHashSentinel);

        hashForWitnessV1(
            "BTC",
            btcNetwork,
            [
                { script: s0, amount: 10n },
                { script: s1, amount: 20n },
                { script: s2, amount: 30n },
            ] as never,
            { preimageWitnessV1 } as never,
            0,
        );

        const [, scripts, , amounts] = preimageWitnessV1.mock.calls[0];
        expect(scripts).toEqual([s0, s1, s2]);
        expect(amounts).toEqual([10n, 20n, 30n]);
        expect(scripts[0]).toBe(s0);
        expect(scripts[1]).toBe(s1);
        expect(scripts[2]).toBe(s2);
    });

    test("empty inputs produce two empty parallel arrays", () => {
        const preimageWitnessV1 = vi.fn().mockReturnValue(btcHashSentinel);

        const result = hashForWitnessV1(
            "BTC",
            btcNetwork,
            [] as never,
            { preimageWitnessV1 } as never,
            3,
        );

        expect(result).toBe(btcHashSentinel);
        expect(preimageWitnessV1).toHaveBeenCalledTimes(1);
        expect(preimageWitnessV1).toHaveBeenCalledWith(
            3,
            [],
            SigHash.DEFAULT,
            [],
        );
    });

    test("any non 'L-BTC' asset (e.g. RBTC) uses the BTC preimage branch", () => {
        const liquidSpy = vi
            .spyOn(LiquidTaprootUtils, "hashForWitnessV1")
            .mockReturnValue("WRONG" as never);
        const preimageWitnessV1 = vi.fn().mockReturnValue(btcHashSentinel);
        const s0 = new Uint8Array([0xc0]);

        const result = hashForWitnessV1(
            "RBTC",
            btcNetwork,
            [{ script: s0, amount: 555n }] as never,
            { preimageWitnessV1 } as never,
            0,
        );

        expect(result).toBe(btcHashSentinel);
        expect(liquidSpy).not.toHaveBeenCalled();
        expect(preimageWitnessV1).toHaveBeenCalledWith(
            0,
            [s0],
            SigHash.DEFAULT,
            [555n],
        );
    });
});
