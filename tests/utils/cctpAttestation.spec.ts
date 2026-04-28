import { config } from "../../src/config";
import {
    getCctpForwardTxHash,
    waitForCctpForwardTxHash,
} from "../../src/utils/cctp/attestation";

describe("cctpAttestation", () => {
    const originalFeeApiUrl = config.cctpApiUrl;

    beforeEach(() => {
        config.cctpApiUrl = "https://iris-api.circle.com";
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(() => {
        config.cctpApiUrl = originalFeeApiUrl;
    });

    test("getCctpForwardTxHash returns the forwardTxHash when present", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [
                        {
                            status: "complete",
                            forwardTxHash: "0xdeadbeef",
                        },
                    ],
                }),
        } as Response);

        await expect(getCctpForwardTxHash(3, "0xburn")).resolves.toBe(
            "0xdeadbeef",
        );
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/messages/3?transactionHash=0xburn",
            expect.any(Object),
        );
    });

    test("getCctpForwardTxHash returns undefined while the message is still pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [{ status: "pending_confirmations" }],
                }),
        } as Response);

        await expect(
            getCctpForwardTxHash(3, "0xburn"),
        ).resolves.toBeUndefined();
    });

    test("getCctpForwardTxHash treats 404 as pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 404,
        } as Response);

        await expect(
            getCctpForwardTxHash(3, "0xburn"),
        ).resolves.toBeUndefined();
    });

    test("waitForCctpForwardTxHash polls until forwardTxHash appears", async () => {
        const calls = [
            // First response: pending
            {
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        messages: [{ status: "pending_confirmations" }],
                    }),
            },
            // Second response: 404 (not yet indexed)
            { ok: false, status: 404 },
            // Third response: complete
            {
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        messages: [
                            {
                                status: "complete",
                                forwardTxHash: "0xmint",
                            },
                        ],
                    }),
            },
        ] as Response[];
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(() => Promise.resolve(calls.shift()!));

        const progressCalls: (string | undefined)[] = [];
        const result = await waitForCctpForwardTxHash(3, "0xburn", {
            intervalMs: 1,
            onProgress: ({ status }) => progressCalls.push(status),
        });

        expect(result).toEqual({
            forwardTxHash: "0xmint",
            status: "complete",
        });
        expect(fetchSpy).toHaveBeenCalledTimes(3);
        expect(progressCalls).toEqual([
            "pending_confirmations",
            undefined, // 404 → no status
        ]);
    });

    test("waitForCctpForwardTxHash honors an AbortSignal", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ messages: [{ status: "pending" }] }),
        } as Response);

        const controller = new AbortController();
        const promise = waitForCctpForwardTxHash(3, "0xburn", {
            intervalMs: 1_000,
            signal: controller.signal,
        });
        controller.abort(new Error("aborted"));

        await expect(promise).rejects.toThrow("aborted");
    });

    test("waitForCctpForwardTxHash aborts an in-flight request", async () => {
        const controller = new AbortController();
        const abortReason = new Error("request aborted");
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation((_url, init) => {
                const signal = init?.signal;
                return new Promise<Response>((_resolve, reject) => {
                    signal?.addEventListener(
                        "abort",
                        () => reject(signal.reason),
                        { once: true },
                    );
                });
            });

        const promise = waitForCctpForwardTxHash(3, "0xburn", {
            intervalMs: 1_000,
            signal: controller.signal,
        });
        await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
        expect(fetchSpy.mock.calls[0][1]?.signal).toBe(controller.signal);

        controller.abort(abortReason);

        await expect(promise).rejects.toThrow("request aborted");
    });

    test("waitForCctpForwardTxHash surfaces non-404 HTTP errors", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 503,
        } as Response);

        await expect(
            waitForCctpForwardTxHash(3, "0xburn", { intervalMs: 1 }),
        ).rejects.toThrow("HTTP 503");
    });
});
