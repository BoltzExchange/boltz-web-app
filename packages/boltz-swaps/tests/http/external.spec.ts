import { afterEach, describe, expect, test, vi } from "vitest";

import { fetchExternalJson } from "../../src/http/external.ts";

describe("fetchExternalJson", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test("returns parsed JSON and forwards the url with composed init on ok", async () => {
        const payload = {
            hello: "world",
            nested: { count: 3 },
            list: [1, 2, 3],
        };
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(payload), {
                headers: { "content-type": "application/json" },
                status: 200,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const init: RequestInit = {
            method: "POST",
            body: "abc",
            headers: { "x-test": "1" },
        };
        const result = await fetchExternalJson<typeof payload>(
            "https://example.com/api",
            5_000,
            init,
        );

        expect(result).toEqual(payload);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://example.com/api",
            expect.objectContaining({
                method: "POST",
                body: "abc",
                headers: { "x-test": "1" },
                signal: expect.any(AbortSignal),
            }),
        );
        // No caller signal was provided, so the controller signal is used
        // directly and must not already be aborted on success.
        const forwarded = fetchMock.mock.calls[0][1] as RequestInit;
        expect((forwarded.signal as AbortSignal).aborted).toBe(false);
    });

    test("rejects with the formatted JSON error body when not ok", async () => {
        const response = new Response(
            JSON.stringify({ status: "ERROR", reason: "no user" }),
            {
                status: 404,
                headers: { "content-type": "application/json" },
            },
        );
        const fetchMock = vi.fn().mockResolvedValue(response);
        vi.stubGlobal("fetch", fetchMock);

        const rejected = await fetchExternalJson(
            "https://example.com/fail",
        ).catch((err: unknown) => err);

        expect(rejected).toBeInstanceOf(Error);
        expect((rejected as Error).message).toBe(
            JSON.stringify({ status: "ERROR", reason: "no user" }),
        );
    });

    test("rejects with the text body when not ok and not JSON", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("nope", { status: 500 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            fetchExternalJson("https://example.com/fail"),
        ).rejects.toThrow("nope");
    });

    test("falls back to a status message when the error body fails to parse", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response("not json", {
                status: 500,
                headers: { "content-type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            fetchExternalJson("https://example.com/fail"),
        ).rejects.toThrow("request failed with status 500");
    });

    test("rejects with a status message when not ok and the body is empty", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response("", { status: 502 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            fetchExternalJson("https://example.com/fail"),
        ).rejects.toThrow("request failed with status 502");
    });

    test("aborts the request via the default 15s timeout when none is passed", async () => {
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

        const request = fetchExternalJson("https://example.com/data");
        const rejection = expect(request).rejects.toThrow("Request timed out");

        // fetch is invoked synchronously before the first await.
        expect(requestSignal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(14_999);
        expect(requestSignal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await rejection;
        expect(requestSignal?.aborted).toBe(true);
    });

    test("honors an explicit timeoutMs (aborts at that value, not the default)", async () => {
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

        const request = fetchExternalJson("https://example.com/data", 5_000);
        const rejection = expect(request).rejects.toThrow("Request timed out");

        await vi.advanceTimersByTimeAsync(4_999);
        expect(requestSignal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await rejection;
        expect(requestSignal?.aborted).toBe(true);
    });

    test("aborts the request when the caller signal fires", async () => {
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

        const callerController = new AbortController();
        const request = fetchExternalJson("https://example.com/slow", 15_000, {
            signal: callerController.signal,
        });
        const rejection = expect(request).rejects.toBe("caller aborted");

        // The composed signal is a new AbortSignal.any signal, not the
        // caller's own signal, but firing the caller aborts it.
        expect(requestSignal).not.toBe(callerController.signal);
        expect(requestSignal?.aborted).toBe(false);

        callerController.abort("caller aborted");
        await rejection;
        expect(requestSignal?.aborted).toBe(true);
    });

    test("clears the internal timeout on success (no leaked timers)", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), {
                headers: { "content-type": "application/json" },
                status: 200,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        expect(vi.getTimerCount()).toBe(0);
        await fetchExternalJson("https://example.com/api");
        expect(vi.getTimerCount()).toBe(0);
    });
});
