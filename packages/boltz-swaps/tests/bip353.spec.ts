import type * as ClientModule from "../src/client.ts";
import { fetchBip353, resolveBip353 } from "../src/dnssec/bip353.ts";
import type * as InvoiceModule from "../src/invoice.ts";

const { lookupMock, fetchBolt12InvoiceMock, validateInvoiceForOfferMock } =
    vi.hoisted(() => ({
        lookupMock: vi.fn(),
        fetchBolt12InvoiceMock: vi.fn(),
        validateInvoiceForOfferMock: vi.fn(),
    }));

vi.mock("../src/dnssec/dohLookup.ts", () => ({
    lookup: lookupMock,
}));

vi.mock("../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    fetchBolt12Invoice: fetchBolt12InvoiceMock,
}));

vi.mock("../src/invoice.ts", async (importActual) => ({
    ...(await importActual<typeof InvoiceModule>()),
    validateInvoiceForOffer: validateInvoiceForOfferMock,
}));

const doh = "https://doh.test/dns-query";

const proof = (overrides: Record<string, unknown> = {}) => ({
    valid_from: 0,
    expires: 9_999_999_999,
    max_cache_ttl: 0,
    verified_rrs: [{ type: "txt", name: "", contents: "bitcoin:?lno=lno1abc" }],
    ...overrides,
});

describe("resolveBip353", () => {
    beforeEach(() => vi.clearAllMocks());

    test("rejects an invalid BIP-353 string without a DNS lookup", async () => {
        await expect(resolveBip353("noat", doh)).rejects.toThrow(
            "invalid BIP-353",
        );
        expect(lookupMock).not.toHaveBeenCalled();
    });

    test("strips the ₿ prefix and queries the BIP-353 name", async () => {
        lookupMock.mockResolvedValue(proof());

        const offer = await resolveBip353("₿user@example.com", doh);

        expect(offer).toBe("lno1abc");
        expect(lookupMock).toHaveBeenCalledWith(
            "user.user._bitcoin-payment.example.com",
            "txt",
            doh,
            undefined,
        );
    });

    test("ignores non-matching records and matches bitcoin: case-insensitively", async () => {
        lookupMock.mockResolvedValue(
            proof({
                verified_rrs: [
                    { type: "a", name: "", contents: "1.2.3.4" },
                    { type: "txt", name: "", contents: "v=spf1 -all" },
                    { type: "txt", name: "", contents: [66, 105, 116] },
                    { type: "txt", name: "", contents: "Bitcoin:?lno=lno1abc" },
                ],
            }),
        );
        expect(await resolveBip353("user@example.com", doh)).toBe("lno1abc");
    });

    test("strips surrounding quotes from the offer", async () => {
        lookupMock.mockResolvedValue(
            proof({
                verified_rrs: [
                    {
                        type: "txt",
                        name: "",
                        contents: 'bitcoin:?lno="lno1abc"',
                    },
                ],
            }),
        );
        expect(await resolveBip353("user@example.com", doh)).toBe("lno1abc");
    });

    test.each<[string, Record<string, unknown>, string]>([
        ["expired proof", { expires: 1 }, "proof has expired"],
        [
            "not-yet-valid proof",
            { valid_from: 9_999_999_999 },
            "proof is not valid yet",
        ],
        ["no TXT record", { verified_rrs: [] }, "no bitcoin: TXT record"],
        [
            "non-txt record",
            { verified_rrs: [{ type: "a", name: "", contents: "1.2.3.4" }] },
            "no bitcoin: TXT record",
        ],
        [
            "TXT record without bitcoin: prefix",
            {
                verified_rrs: [
                    { type: "txt", name: "", contents: "v=spf1 -all" },
                ],
            },
            "no bitcoin: TXT record",
        ],
        [
            "multiple bitcoin: TXT records",
            {
                verified_rrs: [
                    {
                        type: "txt",
                        name: "",
                        contents: "bitcoin:?lno=lno1abc",
                    },
                    {
                        type: "txt",
                        name: "",
                        contents: "bitcoin:?lno=lno1def",
                    },
                ],
            },
            "multiple bitcoin: TXT records",
        ],
        [
            "missing lno",
            {
                verified_rrs: [
                    { type: "txt", name: "", contents: "bitcoin:?other=x" },
                ],
            },
            "missing lno parameter in bip353 payment request",
        ],
    ])("rejects on %s", async (_label, overrides, message) => {
        lookupMock.mockResolvedValue(proof(overrides));
        await expect(resolveBip353("user@example.com", doh)).rejects.toThrow(
            message,
        );
    });
});

describe("fetchBip353", () => {
    beforeEach(() => vi.clearAllMocks());

    test("resolves the offer then fetches and validates the invoice", async () => {
        lookupMock.mockResolvedValue(proof());
        fetchBolt12InvoiceMock.mockResolvedValue({ invoice: "lni1inv" });

        const invoice = await fetchBip353("user@example.com", 1234, doh);

        expect(invoice).toBe("lni1inv");
        expect(fetchBolt12InvoiceMock).toHaveBeenCalledWith("lno1abc", 1234, {
            signal: undefined,
        });
        expect(validateInvoiceForOfferMock).toHaveBeenCalledWith(
            "lno1abc",
            "lni1inv",
        );
    });

    test("threads the abort signal to the lookup and invoice fetch", async () => {
        const controller = new AbortController();
        lookupMock.mockResolvedValue(proof());
        fetchBolt12InvoiceMock.mockResolvedValue({ invoice: "lni1inv" });

        await fetchBip353("user@example.com", 1234, doh, controller.signal);

        expect(lookupMock).toHaveBeenCalledWith(
            "user.user._bitcoin-payment.example.com",
            "txt",
            doh,
            controller.signal,
        );
        expect(fetchBolt12InvoiceMock).toHaveBeenCalledWith("lno1abc", 1234, {
            signal: controller.signal,
        });
    });
});
