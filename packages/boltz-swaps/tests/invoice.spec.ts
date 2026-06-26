import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import bolt11 from "bolt11";
import * as Bolt12 from "bolt12-utils";
import {
    InvoiceType,
    assertPreimageHash,
    decodeInvoice,
    isBolt12Offer,
    validateInvoiceForOffer,
} from "boltz-swaps/invoice";

describe("decodeInvoice bolt11 millisatoshi rounding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test.each`
        millisatoshis | expectedSats | description
        ${1509895001} | ${1509895}   | ${"1 msat remainder - round down"}
        ${1509895499} | ${1509895}   | ${"499 msat remainder - round down"}
        ${1509895500} | ${1509896}   | ${"500 msat remainder - round up"}
        ${1509895999} | ${1509896}   | ${"999 msat remainder - round up"}
        ${1000}       | ${1}         | ${"exact conversion"}
        ${0}          | ${0}         | ${"zero amount"}
    `(
        "rounds $millisatoshis msat to $expectedSats sats ($description)",
        ({ millisatoshis, expectedSats }) => {
            vi.spyOn(bolt11, "decode").mockReturnValue({
                millisatoshis: millisatoshis.toString(),
                tags: [{ tagName: "payment_hash", data: "mock_hash" }],
            } as ReturnType<typeof bolt11.decode>);

            expect(decodeInvoice("lnbc1mock").satoshis).toBe(expectedSats);
        },
    );
});

describe("decodeInvoice bolt12 millisatoshi rounding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test.each`
        invoiceAmount  | expectedSats | description
        ${1509895001n} | ${1509895}   | ${"1 msat remainder - round down"}
        ${1509895499n} | ${1509895}   | ${"499 msat remainder - round down"}
        ${1509895500n} | ${1509896}   | ${"500 msat remainder - round up"}
        ${1509895999n} | ${1509896}   | ${"999 msat remainder - round up"}
        ${1000n}       | ${1}         | ${"exact conversion"}
        ${0n}          | ${0}         | ${"zero amount"}
    `(
        "rounds bolt12 $invoiceAmount msat to $expectedSats sats ($description)",
        ({ invoiceAmount, expectedSats }) => {
            vi.spyOn(bolt11, "decode").mockImplementation(() => {
                throw new Error("invalid bolt11");
            });
            vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
                hrp: "lni",
                data: new Uint8Array(),
            });
            vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
            vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
                invoice_amount: invoiceAmount,
                invoice_payment_hash: new Uint8Array(32).fill(1),
                records: [],
            });

            const result = decodeInvoice("lni1mock");
            expect(result.type).toBe(InvoiceType.Bolt12);
            expect(result.satoshis).toBe(expectedSats);
        },
    );
});

describe("decodeInvoice error handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("throws 'invalid invoice' when neither bolt11 nor bolt12 decode", () => {
        vi.spyOn(bolt11, "decode").mockImplementation(() => {
            throw new Error("bad bolt11");
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockImplementation(() => {
            throw new Error("bad bolt12");
        });

        let thrown: unknown;
        try {
            decodeInvoice("garbage");
        } catch (e) {
            thrown = e;
        }
        expect((thrown as Error).message).toBe("invalid invoice");
        expect(((thrown as Error).cause as Error).message).toBe("bad bolt12");
    });

    test("surfaces a bolt12 invoice missing its payment hash as 'invalid invoice'", () => {
        vi.spyOn(bolt11, "decode").mockImplementation(() => {
            throw new Error("not bolt11");
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_payment_hash: undefined,
            records: [],
        });

        let thrown: unknown;
        try {
            decodeInvoice("lni1mock");
        } catch (e) {
            thrown = e;
        }
        expect((thrown as Error).message).toBe("invalid invoice");
        expect(((thrown as Error).cause as Error).message).toBe(
            "missing bolt12 payment hash",
        );
    });

    test("rejects a bolt12 invoice with a non-'lni' human-readable prefix", () => {
        vi.spyOn(bolt11, "decode").mockImplementation(() => {
            throw new Error("not bolt11");
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lno",
            data: new Uint8Array(),
        });

        let thrown: unknown;
        try {
            decodeInvoice("lno1mock");
        } catch (e) {
            thrown = e;
        }
        expect((thrown as Error).message).toBe("invalid invoice");
        expect(((thrown as Error).cause as Error).message).toBe(
            "invalid bolt12 invoice",
        );
    });
});

describe("validateInvoiceForOffer", () => {
    const privateKey = new Uint8Array(32).fill(1);
    const compressedPubkey = secp256k1.getPublicKey(privateKey, true);
    const xOnlyPubkey = compressedPubkey.slice(1);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("compares the offer signer against the normalized invoice node id", () => {
        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: false,
            issuer_id: hex.encode(compressedPubkey),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: compressedPubkey,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });
        vi.spyOn(Bolt12, "computeMerkleRoot").mockReturnValue(
            new Uint8Array(32).fill(3),
        );
        const verifySignature = vi
            .spyOn(Bolt12, "verifySignature")
            .mockReturnValue(true);

        expect(() =>
            validateInvoiceForOffer("lno1mock", "lni1mock"),
        ).not.toThrow();
        expect(verifySignature).toHaveBeenCalledWith(
            "invoice",
            new Uint8Array(32).fill(3),
            xOnlyPubkey,
            new Uint8Array(64).fill(2),
        );
    });

    test("normalizes compressed pubkeys from blinded paths", () => {
        const pathBytes = new Uint8Array(102);
        pathBytes[66] = 1;
        pathBytes.set(compressedPubkey, 67);

        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: true,
            paths: hex.encode(pathBytes),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: compressedPubkey,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });
        vi.spyOn(Bolt12, "computeMerkleRoot").mockReturnValue(
            new Uint8Array(32).fill(3),
        );
        vi.spyOn(Bolt12, "verifySignature").mockReturnValue(true);

        expect(() =>
            validateInvoiceForOffer("lno1mock", "lni1mock"),
        ).not.toThrow();
    });

    test("accepts x-only keys without conversion", () => {
        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: false,
            issuer_id: hex.encode(xOnlyPubkey),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: xOnlyPubkey,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });
        vi.spyOn(Bolt12, "computeMerkleRoot").mockReturnValue(
            new Uint8Array(32).fill(3),
        );
        const verifySignature = vi
            .spyOn(Bolt12, "verifySignature")
            .mockReturnValue(true);

        expect(() =>
            validateInvoiceForOffer("lno1mock", "lni1mock"),
        ).not.toThrow();
        expect(verifySignature).toHaveBeenCalledWith(
            "invoice",
            new Uint8Array(32).fill(3),
            xOnlyPubkey,
            new Uint8Array(64).fill(2),
        );
    });

    test("throws when invoice_node_id is missing", () => {
        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: false,
            issuer_id: hex.encode(compressedPubkey),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: undefined,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });

        expect(() => validateInvoiceForOffer("lno1mock", "lni1mock")).toThrow(
            "invalid invoice signature",
        );
    });

    test("throws when signature is missing", () => {
        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: false,
            issuer_id: hex.encode(compressedPubkey),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: compressedPubkey,
            signature: undefined,
            records: [],
        });

        expect(() => validateInvoiceForOffer("lno1mock", "lni1mock")).toThrow(
            "invalid invoice signature",
        );
    });

    test("throws when signature verification fails", () => {
        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: false,
            issuer_id: hex.encode(compressedPubkey),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: compressedPubkey,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });
        vi.spyOn(Bolt12, "computeMerkleRoot").mockReturnValue(
            new Uint8Array(32).fill(3),
        );
        vi.spyOn(Bolt12, "verifySignature").mockReturnValue(false);

        expect(() => validateInvoiceForOffer("lno1mock", "lni1mock")).toThrow(
            "invalid invoice signature",
        );
    });

    test("throws when the invoice signer does not match the offer", () => {
        const otherKey = secp256k1.getPublicKey(
            new Uint8Array(32).fill(2),
            true,
        );

        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: false,
            issuer_id: hex.encode(compressedPubkey),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: otherKey,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });
        vi.spyOn(Bolt12, "computeMerkleRoot").mockReturnValue(
            new Uint8Array(32).fill(3),
        );
        vi.spyOn(Bolt12, "verifySignature").mockReturnValue(true);

        expect(() => validateInvoiceForOffer("lno1mock", "lni1mock")).toThrow(
            "invoice does not belong to offer",
        );
    });

    test("extracts the signer from the final hop of a multi-hop blinded path", () => {
        // first_node(33) + blinding(33) + numHops(1)=2 + hop0[node(33)+enclen(2)]
        // + hop1[node(33)+enclen(2)]; only the final hop's node can sign.
        const path = new Uint8Array(137);
        path[66] = 2;
        path.set(compressedPubkey, 102);

        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: true,
            paths: hex.encode(path),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: compressedPubkey,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });
        vi.spyOn(Bolt12, "computeMerkleRoot").mockReturnValue(
            new Uint8Array(32).fill(3),
        );
        vi.spyOn(Bolt12, "verifySignature").mockReturnValue(true);

        expect(() =>
            validateInvoiceForOffer("lno1mock", "lni1mock"),
        ).not.toThrow();
    });

    test("extracts no signer from a truncated blinded path", () => {
        // numHops=1 but the encrypted-data length (0xffff) runs past the buffer,
        // so the parser yields no final node id and the offer has no fallback.
        const path = new Uint8Array(102);
        path[66] = 1;
        path.set(compressedPubkey, 67);
        path[100] = 0xff;
        path[101] = 0xff;

        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({
            hrp: "lno",
            offer_id: new Uint8Array(32).fill(4),
            has_paths: true,
            paths: hex.encode(path),
            records: [],
        });
        vi.spyOn(Bolt12, "decodeBolt12").mockReturnValue({
            hrp: "lni",
            data: new Uint8Array(),
        });
        vi.spyOn(Bolt12, "parseTlvStream").mockReturnValue([]);
        vi.spyOn(Bolt12, "extractInvoiceFields").mockReturnValue({
            invoice_node_id: compressedPubkey,
            signature: new Uint8Array(64).fill(2),
            records: [],
        });
        vi.spyOn(Bolt12, "computeMerkleRoot").mockReturnValue(
            new Uint8Array(32).fill(3),
        );
        vi.spyOn(Bolt12, "verifySignature").mockReturnValue(true);

        expect(() => validateInvoiceForOffer("lno1mock", "lni1mock")).toThrow(
            "invoice does not belong to offer",
        );
    });
});

describe("isBolt12Offer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("true for a decodable offer", () => {
        vi.spyOn(Bolt12, "decodeOffer").mockReturnValue({} as never);
        expect(isBolt12Offer("lno1mock")).toBe(true);
    });

    test("false when decoding throws", () => {
        vi.spyOn(Bolt12, "decodeOffer").mockImplementation(() => {
            throw new Error("not an offer");
        });
        expect(isBolt12Offer("nope")).toBe(false);
    });
});

describe("assertPreimageHash", () => {
    const preimage = new Uint8Array([1, 2, 3, 4]);

    test("accepts a preimage matching the expected hash", () => {
        expect(() =>
            assertPreimageHash(hex.encode(sha256(preimage)), preimage),
        ).not.toThrow();
    });

    test("throws on a mismatched preimage", () => {
        expect(() => assertPreimageHash("00".repeat(32), preimage)).toThrow(
            /invalid preimage/,
        );
    });
});
