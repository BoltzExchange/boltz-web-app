import { tryFetchSolburnAllocation } from "boltz-swaps/cctp";
import log from "loglevel";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const validAllocateBody = () => ({
    event_rent_payer: { secret: Array.from({ length: 64 }, (_, i) => i) },
    message_sent_event_data: {
        secret: Array.from({ length: 64 }, (_, i) => i + 64),
    },
});

const okResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
    });

describe("tryFetchSolburnAllocation", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});

    beforeEach(() => {
        fetchSpy.mockReset();
        warnSpy.mockClear();
    });

    afterEach(() => {
        fetchSpy.mockReset();
    });

    test("returns parsed Uint8Array secrets on a successful response", async () => {
        fetchSpy.mockResolvedValueOnce(okResponse(validAllocateBody()));

        const allocation = await tryFetchSolburnAllocation(
            "https://solburn.example",
        );

        expect(allocation).not.toBeNull();
        expect(allocation?.eventRentPayerSecret).toBeInstanceOf(Uint8Array);
        expect(allocation?.eventRentPayerSecret).toHaveLength(64);
        expect(allocation?.eventRentPayerSecret[0]).toBe(0);
        expect(allocation?.messageSentEventDataSecret).toBeInstanceOf(
            Uint8Array,
        );
        expect(allocation?.messageSentEventDataSecret).toHaveLength(64);
        expect(allocation?.messageSentEventDataSecret[0]).toBe(64);
    });

    test("POSTs to the /allocate endpoint", async () => {
        fetchSpy.mockResolvedValueOnce(okResponse(validAllocateBody()));

        await tryFetchSolburnAllocation("https://solburn.example");

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0]!;
        expect(url).toBe("https://solburn.example/allocate");
        expect(init?.method).toBe("POST");
    });

    test.each([
        ["https://solburn.example/", "https://solburn.example/allocate"],
        ["https://solburn.example///", "https://solburn.example/allocate"],
        [
            "https://solburn.example/api/",
            "https://solburn.example/api/allocate",
        ],
    ])("strips trailing slashes from %s", async (input, expected) => {
        fetchSpy.mockResolvedValueOnce(okResponse(validAllocateBody()));

        await tryFetchSolburnAllocation(input);

        expect(fetchSpy.mock.calls[0]![0]).toBe(expected);
    });

    test("returns null when the server responds non-2xx", async () => {
        fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 503 }));

        const allocation = await tryFetchSolburnAllocation(
            "https://solburn.example",
        );

        expect(allocation).toBeNull();
    });

    test("returns null when fetch throws", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("network down"));

        const allocation = await tryFetchSolburnAllocation(
            "https://solburn.example",
        );

        expect(allocation).toBeNull();
    });
});
