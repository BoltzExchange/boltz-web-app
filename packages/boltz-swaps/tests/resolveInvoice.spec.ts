import { LnurlAmountError, LnurlAmountErrorKind } from "boltz-swaps/errors";
import { InvoiceType } from "boltz-swaps/invoice";
import { resolveInvoice } from "boltz-swaps/resolveInvoice";

import type * as ClientModule from "../src/client.ts";
import type * as InvoiceModule from "../src/invoice.ts";
import type * as LnurlModule from "../src/lnurl.ts";

const {
    isBolt12OfferMock,
    decodeInvoiceMock,
    validateInvoiceForOfferMock,
    isLnurlMock,
    fetchLnurlMock,
    fetchBolt12InvoiceMock,
    fetchBip353Mock,
} = vi.hoisted(() => ({
    isBolt12OfferMock: vi.fn(),
    decodeInvoiceMock: vi.fn(),
    validateInvoiceForOfferMock: vi.fn(),
    isLnurlMock: vi.fn(),
    fetchLnurlMock: vi.fn(),
    fetchBolt12InvoiceMock: vi.fn(),
    fetchBip353Mock: vi.fn(),
}));

vi.mock("../src/invoice.ts", async (importActual) => ({
    ...(await importActual<typeof InvoiceModule>()),
    isBolt12Offer: isBolt12OfferMock,
    decodeInvoice: decodeInvoiceMock,
    validateInvoiceForOffer: validateInvoiceForOfferMock,
}));

vi.mock("../src/lnurl.ts", async (importActual) => ({
    ...(await importActual<typeof LnurlModule>()),
    isLnurl: isLnurlMock,
    fetchLnurl: fetchLnurlMock,
}));

vi.mock("../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    fetchBolt12Invoice: fetchBolt12InvoiceMock,
}));

vi.mock("../src/dnssec/bip353.ts", () => ({
    fetchBip353: fetchBip353Mock,
}));

describe("resolveInvoice", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isBolt12OfferMock.mockReturnValue(false);
        isLnurlMock.mockReturnValue(false);
        decodeInvoiceMock.mockImplementation((invoice: string) => ({
            type: invoice.startsWith("lni")
                ? InvoiceType.Bolt12
                : InvoiceType.Bolt11,
            satoshis: 0,
            preimageHash: "",
        }));
    });

    test("resolves a BOLT12 offer via fetch + validate", async () => {
        isBolt12OfferMock.mockReturnValue(true);
        fetchBolt12InvoiceMock.mockResolvedValue({ invoice: "lni1offerinv" });

        const result = await resolveInvoice("lno1offer", 1000);

        expect(result).toEqual({
            invoice: "lni1offerinv",
            type: InvoiceType.Bolt12,
        });
        expect(fetchBolt12InvoiceMock).toHaveBeenCalledWith("lno1offer", 1000, {
            signal: undefined,
            timeoutMs: undefined,
        });
        expect(validateInvoiceForOfferMock).toHaveBeenCalledWith(
            "lno1offer",
            "lni1offerinv",
        );
        expect(fetchBip353Mock).not.toHaveBeenCalled();
        expect(fetchLnurlMock).not.toHaveBeenCalled();
    });

    test("forwards a custom timeout to the BOLT12 fetch", async () => {
        isBolt12OfferMock.mockReturnValue(true);
        fetchBolt12InvoiceMock.mockResolvedValue({ invoice: "lni1offerinv" });

        await resolveInvoice("lno1offer", 1000, { timeoutMs: 5_000 });

        expect(fetchBolt12InvoiceMock).toHaveBeenCalledWith("lno1offer", 1000, {
            signal: undefined,
            timeoutMs: 5_000,
        });
    });

    test("passes a plain BOLT11 invoice through", async () => {
        const result = await resolveInvoice("lnbc1plain", 1000);

        expect(result).toEqual({
            invoice: "lnbc1plain",
            type: InvoiceType.Bolt11,
        });
        expect(fetchLnurlMock).not.toHaveBeenCalled();
        expect(fetchBolt12InvoiceMock).not.toHaveBeenCalled();
    });

    test("strips a lightning: prefix before routing", async () => {
        await resolveInvoice("lightning:lnbc1plain", 1000);
        expect(decodeInvoiceMock).toHaveBeenCalledWith("lnbc1plain");
    });

    test("resolves a bech32 LNURL without touching BIP-353", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockResolvedValue("lnbc1fromlnurl");

        const result = await resolveInvoice("lnurl1abc", 1000);

        expect(result).toEqual({
            invoice: "lnbc1fromlnurl",
            type: InvoiceType.Bolt11,
        });
        expect(fetchLnurlMock).toHaveBeenCalledWith("lnurl1abc", 1000, {
            signal: undefined,
            timeoutMs: undefined,
        });
        expect(fetchBip353Mock).not.toHaveBeenCalled();
    });

    test("races LNURL vs BIP-353 for a Lightning address; LNURL wins", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockResolvedValue("lnbc1fromlnurl");
        fetchBip353Mock.mockRejectedValue(new Error("no dns record"));

        const result = await resolveInvoice("user@example.com", 1000);

        expect(result.invoice).toBe("lnbc1fromlnurl");
        expect(result.type).toBe(InvoiceType.Bolt11);
        // The lazily imported BIP-353 branch may start after the race ends.
        await vi.waitFor(() => expect(fetchBip353Mock).toHaveBeenCalled());
    });

    test("races LNURL vs BIP-353 for a Lightning address; BIP-353 wins", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockRejectedValue(new Error("no lnurlp host"));
        fetchBip353Mock.mockResolvedValue("lni1frombip353");

        const result = await resolveInvoice("user@example.com", 1000);

        expect(result.invoice).toBe("lni1frombip353");
        expect(result.type).toBe(InvoiceType.Bolt12);
    });

    test("prefers the LnurlAmountError when both race branches reject", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockRejectedValue(
            new LnurlAmountError(LnurlAmountErrorKind.Min, 5000),
        );
        fetchBip353Mock.mockRejectedValue(new Error("no dns record"));

        await expect(
            resolveInvoice("user@example.com", 1),
        ).rejects.toBeInstanceOf(LnurlAmountError);

        await expect(
            resolveInvoice("user@example.com", 1),
        ).rejects.toMatchObject({
            message: "minAmount",
            cause: 5000,
            kind: LnurlAmountErrorKind.Min,
        });
    });

    test("forwards timeoutMs to both race branches", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockResolvedValue("lnbc1fromlnurl");
        fetchBip353Mock.mockRejectedValue(new Error("no dns record"));

        await resolveInvoice("user@example.com", 1000, { timeoutMs: 20 });

        expect(fetchLnurlMock).toHaveBeenCalledWith("user@example.com", 1000, {
            signal: expect.any(AbortSignal),
            timeoutMs: 20,
        });
        await vi.waitFor(() =>
            expect(fetchBip353Mock).toHaveBeenCalledWith(
                "user@example.com",
                1000,
                {
                    dnsOverHttps: undefined,
                    signal: expect.any(AbortSignal),
                    timeoutMs: 20,
                },
            ),
        );
    });

    test("trims whitespace and strips an uppercase lightning: prefix before routing", async () => {
        isBolt12OfferMock.mockReturnValue(true);
        fetchBolt12InvoiceMock.mockResolvedValue({ invoice: "lni1offerinv" });

        const result = await resolveInvoice("  LIGHTNING:LNO1OFFER  ", 1000);

        // The prefix check lowercases, but the slice keeps the original
        // casing, so only "LIGHTNING:" is removed.
        expect(isBolt12OfferMock).toHaveBeenCalledWith("LNO1OFFER");
        expect(fetchBolt12InvoiceMock).toHaveBeenCalledWith("LNO1OFFER", 1000, {
            signal: undefined,
            timeoutMs: undefined,
        });
        expect(validateInvoiceForOfferMock).toHaveBeenCalledWith(
            "LNO1OFFER",
            "lni1offerinv",
        );
        expect(result).toEqual({
            invoice: "lni1offerinv",
            type: InvoiceType.Bolt12,
        });
    });

    test("rejects when the input classifies as nothing and decodeInvoice throws", async () => {
        decodeInvoiceMock.mockImplementation(() => {
            throw new Error("invalid invoice");
        });

        await expect(resolveInvoice("garbage", 1000)).rejects.toThrow(
            "invalid invoice",
        );
        expect(fetchLnurlMock).not.toHaveBeenCalled();
        expect(fetchBolt12InvoiceMock).not.toHaveBeenCalled();
        expect(fetchBip353Mock).not.toHaveBeenCalled();
    });

    test("rejects a cross-network BOLT11 invoice without decoding it", async () => {
        // The configured network defaults to mainnet; "lntb" is testnet.
        await expect(resolveInvoice("lntb1abc", 1000)).rejects.toThrow(
            "invalid invoice",
        );
        expect(decodeInvoiceMock).not.toHaveBeenCalled();
    });

    test("rejects without returning an invoice when offer validation fails", async () => {
        isBolt12OfferMock.mockReturnValue(true);
        fetchBolt12InvoiceMock.mockResolvedValue({ invoice: "lni1offerinv" });
        validateInvoiceForOfferMock.mockImplementation(() => {
            throw new Error("offer mismatch");
        });

        await expect(resolveInvoice("lno1offer", 1000)).rejects.toThrow(
            "offer mismatch",
        );
        expect(fetchBolt12InvoiceMock).toHaveBeenCalledWith("lno1offer", 1000, {
            signal: undefined,
            timeoutMs: undefined,
        });
        expect(validateInvoiceForOfferMock).toHaveBeenCalledWith(
            "lno1offer",
            "lni1offerinv",
        );

        // Avoid leaking the throwing implementation into later tests.
        validateInvoiceForOfferMock.mockReset();
    });

    test("forwards a custom dnsOverHttps endpoint to fetchBip353", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockRejectedValue(new Error("no lnurlp host"));
        fetchBip353Mock.mockResolvedValue("lni1frombip353");

        const result = await resolveInvoice("user@example.com", 1000, {
            dnsOverHttps: "https://doh.custom/x",
        });

        expect(result.invoice).toBe("lni1frombip353");
        expect(fetchBip353Mock).toHaveBeenCalledWith("user@example.com", 1000, {
            dnsOverHttps: "https://doh.custom/x",
            signal: expect.any(AbortSignal),
            timeoutMs: undefined,
        });
    });

    test("forwards an abort signal and timeout to fetchLnurl for a Lightning address", async () => {
        const controller = new AbortController();
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockResolvedValue("lnbc1fromlnurl");
        fetchBip353Mock.mockRejectedValue(new Error("no dns record"));

        await resolveInvoice("user@example.com", 1000, {
            signal: controller.signal,
        });

        // The race passes a derived signal, not the caller's.
        expect(fetchLnurlMock).toHaveBeenCalledWith("user@example.com", 1000, {
            signal: expect.any(AbortSignal),
            timeoutMs: undefined,
        });
    });

    test("aborting the caller signal cancels both race branches", async () => {
        const controller = new AbortController();
        isLnurlMock.mockReturnValue(true);
        const rejectOnAbort = (signal: AbortSignal) =>
            new Promise<string>((_, reject) => {
                if (signal.aborted) {
                    reject(signal.reason);
                    return;
                }
                signal.addEventListener("abort", () => reject(signal.reason), {
                    once: true,
                });
            });
        fetchLnurlMock.mockImplementation(
            (_lnurl, _amount, opts: { signal: AbortSignal }) =>
                rejectOnAbort(opts.signal),
        );
        fetchBip353Mock.mockImplementation(
            (_bip353, _amount, opts: { signal: AbortSignal }) =>
                rejectOnAbort(opts.signal),
        );

        const result = resolveInvoice("user@example.com", 1000, {
            signal: controller.signal,
        });
        controller.abort(new Error("user aborted"));

        await expect(result).rejects.toThrow("user aborted");
    });

    test("aborts the losing branch once the race settles", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockResolvedValue("lnbc1fromlnurl");
        let bip353Signal: AbortSignal | undefined;
        fetchBip353Mock.mockImplementation(
            (_bip353, _amount, opts: { signal: AbortSignal }) => {
                bip353Signal = opts.signal;
                return new Promise<string>(() => {});
            },
        );

        await resolveInvoice("user@example.com", 1000);

        await vi.waitFor(() => expect(bip353Signal?.aborted).toBe(true));
    });

    test("rejects with the amount error while the BIP-353 branch is still pending", async () => {
        isLnurlMock.mockReturnValue(true);
        const amountError = new LnurlAmountError(
            LnurlAmountErrorKind.Min,
            5000,
        );
        fetchLnurlMock.mockRejectedValue(amountError);
        let bip353Signal: AbortSignal | undefined;
        fetchBip353Mock.mockImplementation(
            (_bip353, _amount, opts: { signal: AbortSignal }) => {
                bip353Signal = opts.signal;
                return new Promise<string>(() => {});
            },
        );

        await expect(resolveInvoice("user@example.com", 1)).rejects.toBe(
            amountError,
        );
        await vi.waitFor(() => expect(bip353Signal?.aborted).toBe(true));
    });

    test("passes the caller signal through unchanged outside the race", async () => {
        const controller = new AbortController();
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockResolvedValue("lnbc1fromlnurl");

        await resolveInvoice("lnurl1abc", 1000, {
            signal: controller.signal,
        });

        expect(fetchLnurlMock).toHaveBeenCalledWith("lnurl1abc", 1000, {
            signal: controller.signal,
            timeoutMs: undefined,
        });
    });

    test("forwards a custom timeoutMs to a plain LNURL fetch", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockResolvedValue("lnbc1fromlnurl");

        await resolveInvoice("lnurl1abc", 1000, { timeoutMs: 5 });

        expect(fetchLnurlMock).toHaveBeenCalledWith("lnurl1abc", 1000, {
            signal: undefined,
            timeoutMs: 5,
        });
    });

    test("forwards the amount to fetchBip353 and lets it default the DoH endpoint", async () => {
        isLnurlMock.mockReturnValue(true);
        fetchLnurlMock.mockRejectedValue(new Error("no lnurlp host"));
        fetchBip353Mock.mockResolvedValue("lni1frombip353");

        await resolveInvoice("user@example.com", 4242);

        expect(fetchBip353Mock).toHaveBeenCalledWith("user@example.com", 4242, {
            dnsOverHttps: undefined,
            signal: expect.any(AbortSignal),
            timeoutMs: undefined,
        });
    });

    test("rejects an '@' string that is neither an LNURL nor an invoice", async () => {
        isLnurlMock.mockReturnValue(false);

        await expect(resolveInvoice("weird@thing", 1000)).rejects.toThrow(
            "invalid invoice",
        );
        expect(decodeInvoiceMock).not.toHaveBeenCalled();
        expect(fetchLnurlMock).not.toHaveBeenCalled();
        expect(fetchBip353Mock).not.toHaveBeenCalled();
    });

    test("passes a plain BOLT12 (lni) invoice through with the Bolt12 type", async () => {
        const result = await resolveInvoice("lni1plain", 1000);

        expect(result).toEqual({
            invoice: "lni1plain",
            type: InvoiceType.Bolt12,
        });
        expect(fetchBolt12InvoiceMock).not.toHaveBeenCalled();
        expect(fetchLnurlMock).not.toHaveBeenCalled();
    });
});
