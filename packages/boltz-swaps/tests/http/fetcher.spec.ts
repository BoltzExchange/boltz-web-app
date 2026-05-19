import { setBoltzSwapsConfig } from "boltz-swaps/config";
import { afterEach, describe, expect, test, vi } from "vitest";

import { fetcher } from "../../src/http/fetcher.ts";

describe("fetcher", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        setBoltzSwapsConfig({});
    });

    test("preserves POST body when request options are provided", async () => {
        const controller = new AbortController();
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify([]), {
                headers: { "content-type": "application/json" },
                status: 200,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        setBoltzSwapsConfig({
            boltzApiUrl: "http://localhost:9001",
        });

        await fetcher(
            "/v2/swap/restore",
            { xpub: "xpub", pagination: { startIndex: 0, limit: 10 } },
            { signal: controller.signal },
        );

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:9001/v2/swap/restore",
            expect.objectContaining({
                body: JSON.stringify({
                    xpub: "xpub",
                    pagination: { startIndex: 0, limit: 10 },
                }),
                method: "POST",
            }),
        );
        const requestOptions = fetchMock.mock.calls[0][1] as RequestInit;
        expect(requestOptions.signal).not.toBe(controller.signal);

        controller.abort("caller stopped");
        expect((requestOptions.signal as AbortSignal).aborted).toBe(true);
    });

    test("preserves Headers request options and fills referral", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({}), {
                headers: { "content-type": "application/json" },
                status: 200,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        setBoltzSwapsConfig({
            boltzApiUrl: "http://localhost:9001",
            referral: "test-referral",
        });

        await fetcher("/v2/test", undefined, {
            headers: new Headers({ "x-custom": "value" }),
        });

        const headers = (fetchMock.mock.calls[0][1] as RequestInit)
            .headers as Headers;
        expect(headers.get("x-custom")).toBe("value");
        expect(headers.get("referral")).toBe("test-referral");
    });

    test("does not overwrite an explicit referral header", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({}), {
                headers: { "content-type": "application/json" },
                status: 200,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        setBoltzSwapsConfig({
            boltzApiUrl: "http://localhost:9001",
            referral: "configured-referral",
        });

        await fetcher("/v2/test", undefined, {
            headers: { referral: "request-referral" },
        });

        const headers = (fetchMock.mock.calls[0][1] as RequestInit)
            .headers as Headers;
        expect(headers.get("referral")).toBe("request-referral");
    });

    test("keeps the internal timeout when request options include a signal", async () => {
        vi.useFakeTimers();
        let requestSignal: AbortSignal | undefined;
        const fetchMock = vi.fn(
            (_url: string, options: RequestInit = {}) =>
                new Promise<Response>((_resolve, reject) => {
                    requestSignal = options.signal as AbortSignal;
                    requestSignal.addEventListener(
                        "abort",
                        () => reject(requestSignal?.reason),
                        { once: true },
                    );
                }),
        );
        vi.stubGlobal("fetch", fetchMock);
        setBoltzSwapsConfig({
            boltzApiUrl: "http://localhost:9001",
        });

        const request = fetcher(
            "/v2/slow",
            undefined,
            { signal: new AbortController().signal },
            100,
        );
        const rejection = expect(request).rejects.toThrow("Request timed out");

        await vi.advanceTimersByTimeAsync(100);
        await rejection;
        expect(requestSignal?.aborted).toBe(true);
    });
});
