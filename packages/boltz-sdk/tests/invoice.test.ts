import { BigNumber } from "bignumber.js";
import { vi } from "vitest";

const { mockDecode } = vi.hoisted(() => ({
    mockDecode: vi.fn(),
}));
vi.mock("bolt11", () => ({ default: { decode: mockDecode } }));

import { init } from "../src/public/config";
import { InvoiceValidation } from "../src/public/enums";
import {
    InvoiceType,
    checkLnurlResponse,
    decodeBolt11Invoice,
    extractInvoice,
    isInvoice,
    isLnurl,
    type LnurlResponse,
} from "../src/public/invoice";

const regtestInvoice = "lnbcrt500u1fakeinvoicedata";
const mainnetInvoice = "lnbc500u1fakemainnetdata";

beforeAll(() => {
    init({ apiUrl: "http://localhost:9001", network: "regtest" });
});

describe("decodeBolt11Invoice", () => {
    afterEach(() => {
        mockDecode.mockReset();
    });

    test("decodes invoice and returns satoshis as number", () => {
        mockDecode.mockReturnValue({
            millisatoshis: "50000000",
            tags: [{ tagName: "payment_hash", data: "a".repeat(64) }],
        });

        const result = decodeBolt11Invoice("lnbcrt1whatever");
        expect(result.type).toBe(InvoiceType.Bolt11);
        expect(result.satoshis).toBe(50_000);
        expect(typeof result.satoshis).toBe("number");
        expect(result.preimageHash).toBe("a".repeat(64));
    });

    test("rounds millisatoshis correctly (half-up)", () => {
        mockDecode.mockReturnValue({
            millisatoshis: "1500",
            tags: [{ tagName: "payment_hash", data: "b".repeat(64) }],
        });

        const result = decodeBolt11Invoice("lnbcrt1whatever");
        // 1500 / 1000 = 1.5 → round half up = 2
        expect(result.satoshis).toBe(2);
    });

    test("handles zero millisatoshis", () => {
        mockDecode.mockReturnValue({
            millisatoshis: "0",
            tags: [{ tagName: "payment_hash", data: "c".repeat(64) }],
        });

        const result = decodeBolt11Invoice("lnbcrt1whatever");
        expect(result.satoshis).toBe(0);
    });

    test("handles missing millisatoshis (undefined)", () => {
        mockDecode.mockReturnValue({
            millisatoshis: undefined,
            tags: [{ tagName: "payment_hash", data: "d".repeat(64) }],
        });

        const result = decodeBolt11Invoice("lnbcrt1whatever");
        expect(result.satoshis).toBe(0);
    });

    test("large millisatoshi value", () => {
        mockDecode.mockReturnValue({
            millisatoshis: "2100000000000000000",
            tags: [{ tagName: "payment_hash", data: "e".repeat(64) }],
        });

        const result = decodeBolt11Invoice("lnbcrt1whatever");
        expect(result.satoshis).toBe(2_100_000_000_000_000);
    });
});

describe("extractInvoice", () => {
    test("extracts from lightning: prefix", () => {
        const invoice = "lnbcrt1somedata";
        const result = extractInvoice(`lightning:${invoice}`);
        expect(result).toBe(invoice);
    });

    test("extracts from BIP-21 lightning param", () => {
        const invoice = "lnbcrt1somedata";
        const bip21 = `bitcoin:bc1abc?amount=0.001&lightning=${invoice}`;
        const result = extractInvoice(bip21);
        expect(result).toBe(invoice);
    });

    test("extracts lno param from BIP-21", () => {
        const bip21 = "bitcoin:bc1abc?lno=lni1somebolt12offer";
        const result = extractInvoice(bip21);
        expect(result).toBe("lni1somebolt12offer");
    });

    test("returns null when BIP-21 has no lightning/lno param", () => {
        const bip21 = "bitcoin:bc1abc?amount=0.001";
        expect(extractInvoice(bip21)).toBeNull();
    });

    test("returns input as-is for plain strings", () => {
        const plain = "lnbcrt1somedata";
        expect(extractInvoice(plain)).toBe(plain);
    });

    test("returns null for non-string input", () => {
        expect(extractInvoice(null as unknown as string)).toBeNull();
        expect(extractInvoice(undefined as unknown as string)).toBeNull();
    });

    test("lowercases the extracted invoice", () => {
        const result = extractInvoice("lightning:LNBCRT1SOMEDATA");
        expect(result).toBe("lnbcrt1somedata");
    });
});

describe("isInvoice", () => {
    test("detects regtest invoice with explicit network", () => {
        expect(isInvoice(regtestInvoice, "regtest")).toBe(true);
    });

    test("detects mainnet invoice", () => {
        expect(isInvoice(mainnetInvoice, "mainnet")).toBe(true);
    });

    test("mainnet check rejects regtest invoice", () => {
        expect(isInvoice(regtestInvoice, "mainnet")).toBe(false);
    });

    test("regtest check rejects mainnet invoice", () => {
        expect(isInvoice(mainnetInvoice, "regtest")).toBe(false);
    });

    test("uses configured network when no override given", () => {
        expect(isInvoice(regtestInvoice)).toBe(true);
        expect(isInvoice(mainnetInvoice)).toBe(false);
    });

    test("detects bolt12 lni prefix", () => {
        expect(isInvoice("lni1somedata", "mainnet")).toBe(true);
    });

    test("returns false for non-string", () => {
        expect(isInvoice(42 as unknown as string, "mainnet")).toBe(false);
    });

    test("returns false for empty string", () => {
        expect(isInvoice("", "mainnet")).toBe(false);
    });

    test("testnet invoice detected on testnet", () => {
        expect(isInvoice("lntb1somedata", "testnet")).toBe(true);
    });

    test("testnet invoice rejected on mainnet", () => {
        expect(isInvoice("lntb1somedata", "mainnet")).toBe(false);
    });

    test("case insensitive", () => {
        expect(isInvoice("LNBCRT500U1SOMETHING", "regtest")).toBe(true);
    });
});

describe("isLnurl", () => {
    test("detects Lightning address", () => {
        expect(isLnurl("user@example.com")).toBe(true);
    });

    test("detects Lightning address with lightning: prefix", () => {
        expect(isLnurl("lightning:user@example.com")).toBe(true);
    });

    test("rejects plain email-like with invalid TLD", () => {
        expect(isLnurl("user@x")).toBe(false);
    });

    test("returns false for null / undefined", () => {
        expect(isLnurl(null)).toBe(false);
        expect(isLnurl(undefined)).toBe(false);
    });

    test("returns false for plain invoice", () => {
        expect(isLnurl(regtestInvoice)).toBe(false);
    });

    test("returns false for empty string", () => {
        expect(isLnurl("")).toBe(false);
    });
});

describe("checkLnurlResponse", () => {
    const data: LnurlResponse = {
        minSendable: 1_000,
        maxSendable: 1_000_000,
        callback: "https://example.com/lnurlp/callback",
    };

    test("returns data when amount is within bounds", () => {
        expect(checkLnurlResponse(BigNumber(50_000), data)).toBe(data);
    });

    test("returns data at exact min boundary", () => {
        expect(checkLnurlResponse(BigNumber(1_000), data)).toBe(data);
    });

    test("returns data at exact max boundary", () => {
        expect(checkLnurlResponse(BigNumber(1_000_000), data)).toBe(data);
    });

    test("throws MinAmount when below min", () => {
        expect(() => checkLnurlResponse(BigNumber(999), data)).toThrow(
            InvoiceValidation.MinAmount,
        );
    });

    test("throws MaxAmount when above max", () => {
        expect(() => checkLnurlResponse(BigNumber(1_000_001), data)).toThrow(
            InvoiceValidation.MaxAmount,
        );
    });

    test("MinAmount error carries cause", () => {
        try {
            checkLnurlResponse(BigNumber(0), data);
            expect.unreachable("should have thrown");
        } catch (e) {
            expect((e as Error).cause).toBe(data.minSendable);
        }
    });

    test("MaxAmount error carries cause", () => {
        try {
            checkLnurlResponse(BigNumber(2_000_000), data);
            expect.unreachable("should have thrown");
        } catch (e) {
            expect((e as Error).cause).toBe(data.maxSendable);
        }
    });
});
