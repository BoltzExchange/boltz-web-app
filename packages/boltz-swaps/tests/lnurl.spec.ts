import { bech32, utf8 } from "@scure/base";
import { LnurlAmountError, LnurlAmountErrorKind } from "boltz-swaps/errors";
import {
    fetchLnurl,
    fetchLnurlInvoice,
    isLnurl,
    isValidBech32,
} from "boltz-swaps/lnurl";

import type * as ExternalModule from "../src/http/external.ts";

const { fetchExternalJsonMock } = vi.hoisted(() => ({
    fetchExternalJsonMock: vi.fn(),
}));

vi.mock("../src/http/external.ts", async (importActual) => ({
    ...(await importActual<typeof ExternalModule>()),
    fetchExternalJson: fetchExternalJsonMock,
}));

const encodeLnurl = (url: string): string =>
    bech32.encode("lnurl", bech32.toWords(utf8.decode(url)));

describe("isValidBech32 / isLnurl", () => {
    test("recognizes Lightning addresses", () => {
        expect(isLnurl("user@example.com")).toBe(true);
        expect(isLnurl("₿user@example.com")).toBe(true);
        expect(isLnurl("not an address")).toBe(false);
    });

    test("recognizes bech32 LNURLs and strips the lightning: prefix", () => {
        const lnurl = encodeLnurl("https://example.com/pay");
        expect(isValidBech32(lnurl)).toBe(true);
        expect(isLnurl(lnurl)).toBe(true);
        expect(isLnurl("lightning:" + lnurl)).toBe(true);
        expect(isLnurl("lnurl1notvalidbech32!")).toBe(false);
    });
});

describe("fetchLnurl", () => {
    beforeEach(() => fetchExternalJsonMock.mockReset());

    test("resolves a Lightning address through the two-step flow", async () => {
        fetchExternalJsonMock
            .mockResolvedValueOnce({
                minSendable: 1_000,
                maxSendable: 2_000_000,
                callback: "https://example.com/cb",
            })
            .mockResolvedValueOnce({ pr: "lnbc1invoice" });

        const invoice = await fetchLnurl("user@example.com", 1000);

        expect(invoice).toBe("lnbc1invoice");
        expect(fetchExternalJsonMock).toHaveBeenNthCalledWith(
            1,
            "https://example.com/.well-known/lnurlp/user",
            25_000,
            { signal: expect.any(AbortSignal) },
        );
        expect(fetchExternalJsonMock).toHaveBeenNthCalledWith(
            2,
            "https://example.com/cb?amount=1000000",
            25_000,
            { signal: expect.any(AbortSignal) },
        );
    });

    test("resolves a lightning:-prefixed Lightning address", async () => {
        fetchExternalJsonMock
            .mockResolvedValueOnce({
                minSendable: 1_000,
                maxSendable: 2_000_000,
                callback: "https://example.com/cb",
            })
            .mockResolvedValueOnce({ pr: "lnbc1invoice" });

        await fetchLnurl("lightning:user@example.com", 1000);

        expect(fetchExternalJsonMock).toHaveBeenNthCalledWith(
            1,
            "https://example.com/.well-known/lnurlp/user",
            25_000,
            { signal: expect.any(AbortSignal) },
        );
    });

    test("decodes a bech32 LNURL to its endpoint URL", async () => {
        fetchExternalJsonMock
            .mockResolvedValueOnce({
                minSendable: 0,
                maxSendable: 10_000_000,
                callback: "https://example.com/cb",
            })
            .mockResolvedValueOnce({ pr: "lnbc1invoice" });

        await fetchLnurl(encodeLnurl("https://example.com/pay"), 1000);

        expect(fetchExternalJsonMock).toHaveBeenNthCalledWith(
            1,
            "https://example.com/pay",
            25_000,
            { signal: expect.any(AbortSignal) },
        );
    });

    test("decodes a lightning:-prefixed bech32 LNURL to its endpoint URL", async () => {
        fetchExternalJsonMock
            .mockResolvedValueOnce({
                minSendable: 0,
                maxSendable: 10_000_000,
                callback: "https://example.com/cb",
            })
            .mockResolvedValueOnce({ pr: "lnbc1invoice" });

        await fetchLnurl(
            "lightning:" + encodeLnurl("https://example.com/pay"),
            1000,
        );

        expect(fetchExternalJsonMock).toHaveBeenNthCalledWith(
            1,
            "https://example.com/pay",
            25_000,
            { signal: expect.any(AbortSignal) },
        );
    });

    test("throws LnurlAmountError below minSendable", async () => {
        fetchExternalJsonMock.mockResolvedValueOnce({
            minSendable: 2_000,
            maxSendable: 2_000_000,
            callback: "https://example.com/cb",
        });

        await expect(fetchLnurl("user@example.com", 1)).rejects.toMatchObject({
            message: "minAmount",
            cause: 2_000,
            kind: LnurlAmountErrorKind.Min,
        });
        expect(fetchExternalJsonMock).toHaveBeenCalledTimes(1);
    });

    test("ceils a fractional minSendable when validating", async () => {
        fetchExternalJsonMock.mockResolvedValueOnce({
            minSendable: 2_000.5,
            maxSendable: 2_000_000,
            callback: "https://example.com/cb",
        });

        await expect(fetchLnurl("user@example.com", 2)).rejects.toMatchObject({
            kind: LnurlAmountErrorKind.Min,
            limitMsat: 2_000.5,
        });
    });

    test("floors a fractional maxSendable when validating", async () => {
        fetchExternalJsonMock.mockResolvedValueOnce({
            minSendable: 0,
            maxSendable: 999.9,
            callback: "https://example.com/cb",
        });

        await expect(fetchLnurl("user@example.com", 1)).rejects.toMatchObject({
            kind: LnurlAmountErrorKind.Max,
            limitMsat: 999.9,
        });
    });

    test("rounds a fractional sat amount to the nearest msat", async () => {
        fetchExternalJsonMock
            .mockResolvedValueOnce({
                minSendable: 0,
                maxSendable: 10_000_000,
                callback: "https://example.com/cb",
            })
            .mockResolvedValueOnce({ pr: "lnbc1invoice" });

        await fetchLnurl("user@example.com", 1000.5);

        expect(fetchExternalJsonMock).toHaveBeenNthCalledWith(
            2,
            "https://example.com/cb?amount=1000500",
            25_000,
            { signal: expect.any(AbortSignal) },
        );
    });

    test("throws LnurlAmountError above maxSendable", async () => {
        fetchExternalJsonMock.mockResolvedValueOnce({
            minSendable: 0,
            maxSendable: 1_000,
            callback: "https://example.com/cb",
        });

        const err: unknown = await fetchLnurl("user@example.com", 1000).catch(
            (e: unknown) => e,
        );
        expect(err).toBeInstanceOf(LnurlAmountError);
        expect((err as LnurlAmountError).kind).toBe(LnurlAmountErrorKind.Max);
        expect((err as LnurlAmountError).limitMsat).toBe(1_000);
    });

    test("throws the reason of a LUD-06 error on the metadata response", async () => {
        fetchExternalJsonMock.mockResolvedValueOnce({
            status: "ERROR",
            reason: "user not found",
        });

        await expect(fetchLnurl("user@example.com", 1000)).rejects.toThrow(
            "user not found",
        );
        expect(fetchExternalJsonMock).toHaveBeenCalledTimes(1);
    });

    test("throws the reason of a LUD-06 error on the callback response", async () => {
        fetchExternalJsonMock
            .mockResolvedValueOnce({
                minSendable: 1_000,
                maxSendable: 2_000_000,
                callback: "https://example.com/cb",
            })
            .mockResolvedValueOnce({
                status: "error",
                reason: "route not found",
            });

        await expect(fetchLnurl("user@example.com", 1000)).rejects.toThrow(
            "route not found",
        );
    });

    test("throws a generic error on a LUD-06 error without a reason", async () => {
        fetchExternalJsonMock.mockResolvedValueOnce({ status: "ERROR" });

        await expect(fetchLnurl("user@example.com", 1000)).rejects.toThrow(
            "LNURL error",
        );
    });

    test("aborts in-flight requests when the caller signal aborts", async () => {
        const controller = new AbortController();
        fetchExternalJsonMock.mockImplementationOnce(
            (_url, _timeoutMs, init: { signal: AbortSignal }) =>
                new Promise((_, reject) => {
                    init.signal.addEventListener("abort", () =>
                        reject(init.signal.reason),
                    );
                }),
        );

        const result = fetchLnurl("user@example.com", 1000, {
            signal: controller.signal,
        });
        controller.abort(new Error("user aborted"));

        await expect(result).rejects.toThrow("user aborted");
    });

    test("aborts in-flight requests when timeoutMs elapses end-to-end", async () => {
        fetchExternalJsonMock.mockImplementationOnce(
            (_url, _timeoutMs, init: { signal: AbortSignal }) =>
                new Promise((_, reject) => {
                    init.signal.addEventListener("abort", () =>
                        reject(init.signal.reason),
                    );
                }),
        );

        await expect(
            fetchLnurl("user@example.com", 1000, { timeoutMs: 5 }),
        ).rejects.toMatchObject({ name: "TimeoutError" });
    });
});

describe("fetchLnurlInvoice", () => {
    beforeEach(() => fetchExternalJsonMock.mockReset());

    test("appends the amount param, preserving existing query", async () => {
        fetchExternalJsonMock.mockResolvedValueOnce({ pr: "lnbc1cb" });

        const invoice = await fetchLnurlInvoice(1_000_000n, {
            minSendable: 0,
            maxSendable: 0,
            callback: "https://example.com/cb?comment=hi",
        });

        expect(invoice).toBe("lnbc1cb");
        expect(fetchExternalJsonMock).toHaveBeenCalledWith(
            "https://example.com/cb?comment=hi&amount=1000000",
            undefined,
            { signal: undefined },
        );
    });
});
