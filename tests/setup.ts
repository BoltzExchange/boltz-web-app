import axios from "axios";
import log from "loglevel";

log.setLevel("error");

// Replace jsdom's fetch with axios-based fetch to fix AbortController compatibility
const axiosFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> => {
    const url =
        typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

    try {
        const response = await axios({
            url,
            method: init?.method || "GET",
            headers: init?.headers as Record<string, string>,
            data: init?.body,
            signal: init?.signal as AbortSignal,
        });

        return new Response(JSON.stringify(response.data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers as HeadersInit,
        });
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return new Response(JSON.stringify(error.response.data), {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers as HeadersInit,
            });
        }
        throw error;
    }
};

globalThis.fetch = axiosFetch as typeof fetch;

vi.mock("ethers", () => ({
    JsonRpcProvider: vi.fn(),
    FallbackProvider: vi.fn(),
}));
