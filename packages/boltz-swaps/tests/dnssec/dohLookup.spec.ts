import { type LookupResult, lookup } from "../../src/dnssec/dohLookup.ts";

const {
    initMock,
    initProofBuilderMock,
    getNextQueryMock,
    getUnverifiedProofMock,
    processQueryResponseMock,
    verifyByteStreamMock,
} = vi.hoisted(() => ({
    initMock: vi.fn(),
    initProofBuilderMock: vi.fn(),
    getNextQueryMock: vi.fn(),
    getUnverifiedProofMock: vi.fn(),
    processQueryResponseMock: vi.fn(),
    verifyByteStreamMock: vi.fn(),
}));

vi.mock("../../src/generated/dnssec/dnssec_prover_wasm.ts", () => ({
    default: initMock,
    init_proof_builder: initProofBuilderMock,
    get_next_query: getNextQueryMock,
    get_unverified_proof: getUnverifiedProofMock,
    process_query_response: processQueryResponseMock,
    verify_byte_stream: verifyByteStreamMock,
}));

vi.mock("../../src/generated/dnssec/wasmBytes.ts", () => ({
    getDnssecWasmBytes: () => new Uint8Array([1, 2, 3]),
}));

const endpoint = "https://doh.test/dns-query";

// A distinct sentinel object standing in for the opaque WASMProofBuilder.
const builder = { __sentinel: "builder" };

const sampleResult: LookupResult = {
    expires: 100,
    valid_from: 1,
    max_cache_ttl: 60,
    verified_rrs: [{ type: "txt", name: "example.com.", contents: "hello" }],
};

// Same transform the module applies to the raw query bytes.
const toB64Url = (bytes: Uint8Array): string =>
    btoa(String.fromCodePoint(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

const stubFetch = (
    impl: (...args: unknown[]) => unknown = () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([9, 9]).buffer,
    }),
) => {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

beforeEach(() => {
    vi.clearAllMocks();
    // Happy-path defaults: a valid builder, no query to send, a proof that
    // verifies to sampleResult. Individual tests override as needed.
    initProofBuilderMock.mockReturnValue(builder);
    getNextQueryMock.mockReturnValue(undefined);
    getUnverifiedProofMock.mockReturnValue(new Uint8Array([7, 7, 7]));
    verifyByteStreamMock.mockReturnValue(JSON.stringify(sampleResult));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("lookup", () => {
    test("initialises the WASM with the injected bytes object", async () => {
        stubFetch();

        await lookup("example.com", "txt", endpoint);

        expect(initMock).toHaveBeenCalledTimes(1);
        expect(initMock).toHaveBeenCalledWith({
            module_or_path: new Uint8Array([1, 2, 3]),
        });
    });

    test("appends a trailing dot to a domain lacking one", async () => {
        stubFetch();

        await lookup("example.com", "txt", endpoint);

        expect(initProofBuilderMock).toHaveBeenCalledWith("example.com.", 16);
    });

    test("does not double-append when the domain already ends with a dot", async () => {
        stubFetch();

        await lookup("example.com.", "txt", endpoint);

        expect(initProofBuilderMock).toHaveBeenCalledWith("example.com.", 16);
    });

    test.each<["txt" | "tlsa" | "a" | "aaaa", number]>([
        ["txt", 16],
        ["tlsa", 52],
        ["a", 1],
        ["aaaa", 28],
    ])("maps DNS type %s to record code %i", async (dnsType, code) => {
        stubFetch();

        await lookup("example.com", dnsType, endpoint);

        expect(initProofBuilderMock).toHaveBeenCalledWith("example.com.", code);
    });

    test.each([[null], [undefined]])(
        "throws bad domain when init_proof_builder returns %s (no fetch)",
        async (ret) => {
            const fetchMock = stubFetch();
            initProofBuilderMock.mockReturnValue(ret);

            await expect(
                lookup("example.com", "txt", endpoint),
            ).rejects.toThrow("bad domain");

            expect(fetchMock).not.toHaveBeenCalled();
        },
    );

    test("returns the parsed proof when there is no query to send", async () => {
        stubFetch();

        const result = await lookup("example.com", "txt", endpoint);

        expect(result).toEqual(sampleResult);
        expect(getUnverifiedProofMock).toHaveBeenCalledWith(builder);
        expect(verifyByteStreamMock).toHaveBeenCalledWith(
            new Uint8Array([7, 7, 7]),
            "example.com.",
        );
    });

    test("throws failed to build proof when get_unverified_proof is null", async () => {
        stubFetch();
        getUnverifiedProofMock.mockReturnValue(null);

        await expect(lookup("example.com", "txt", endpoint)).rejects.toThrow(
            "failed to build proof",
        );
        expect(verifyByteStreamMock).not.toHaveBeenCalled();
    });
});

describe("sendQuery", () => {
    test("base64url-encodes the query and fetches the DoH endpoint, then recurses", async () => {
        const queryBytes = new Uint8Array([0, 255, 16]);
        getNextQueryMock
            .mockReturnValueOnce(queryBytes)
            .mockReturnValueOnce(null);
        const fetchMock = stubFetch();

        const result = await lookup("example.com", "txt", endpoint);

        const expectedUrl = endpoint + "?dns=" + toB64Url(queryBytes);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(expectedUrl, {
            headers: { accept: "application/dns-message" },
        });

        // The response bytes are fed back into the prover.
        expect(processQueryResponseMock).toHaveBeenCalledWith(
            builder,
            new Uint8Array([9, 9]),
        );

        // Two queries were pulled: the real one, then the terminating null.
        expect(getNextQueryMock).toHaveBeenCalledTimes(2);
        expect(result).toEqual(sampleResult);
    });

    test("recurses across multiple DoH round-trips before terminating", async () => {
        const q1 = new Uint8Array([1, 2]);
        const q2 = new Uint8Array([3, 4]);
        getNextQueryMock
            .mockReturnValueOnce(q1)
            .mockReturnValueOnce(q2)
            .mockReturnValueOnce(null);
        const fetchMock = stubFetch();

        const result = await lookup("example.com", "txt", endpoint);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            endpoint + "?dns=" + toB64Url(q1),
            { headers: { accept: "application/dns-message" } },
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            endpoint + "?dns=" + toB64Url(q2),
            { headers: { accept: "application/dns-message" } },
        );
        expect(processQueryResponseMock).toHaveBeenCalledTimes(2);
        expect(getNextQueryMock).toHaveBeenCalledTimes(3);
        expect(result).toEqual(sampleResult);
    });

    test("produces a URL-safe base64 string (+/ replaced, padding stripped)", async () => {
        // 2 bytes so standard base64 ("+/8=") contains '+', '/' and '=' padding.
        const queryBytes = new Uint8Array([251, 255]);
        getNextQueryMock
            .mockReturnValueOnce(queryBytes)
            .mockReturnValueOnce(null);
        const fetchMock = stubFetch();

        await lookup("example.com", "txt", endpoint);

        const url = fetchMock.mock.calls[0][0] as string;
        const b64 = url.slice((endpoint + "?dns=").length);
        expect(url).toBe(endpoint + "?dns=" + b64);
        expect(b64).not.toMatch(/[+/=]/);
        expect(b64).toBe(toB64Url(queryBytes));
    });

    test("forwards the abort signal to the DoH fetch", async () => {
        const queryBytes = new Uint8Array([1, 2]);
        getNextQueryMock
            .mockReturnValueOnce(queryBytes)
            .mockReturnValueOnce(null);
        const fetchMock = stubFetch();
        const controller = new AbortController();

        await lookup("example.com", "txt", endpoint, controller.signal);

        expect(fetchMock).toHaveBeenCalledWith(
            endpoint + "?dns=" + toB64Url(queryBytes),
            {
                headers: { accept: "application/dns-message" },
                signal: controller.signal,
            },
        );
    });

    test("throws DoH query failed when the response is not ok", async () => {
        getNextQueryMock.mockReturnValue(new Uint8Array([1]));
        stubFetch(() => ({ ok: false }));

        await expect(lookup("example.com", "txt", endpoint)).rejects.toThrow(
            "DoH query failed",
        );
        expect(processQueryResponseMock).not.toHaveBeenCalled();
    });
});
