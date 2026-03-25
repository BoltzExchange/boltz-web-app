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

vi.mock("ethers", () => {
    const stripPrefix = (value: string) =>
        value.startsWith("0x") ? value.slice(2) : value;
    const toUintHex = (value: bigint | number, bytes: number) =>
        BigInt(value)
            .toString(16)
            .padStart(bytes * 2, "0");
    const formatEther = (value: bigint | number | string) => {
        const amount = BigInt(value);
        const negative = amount < 0n;
        const normalized = negative ? -amount : amount;
        const divisor = 10n ** 18n;
        const whole = normalized / divisor;
        const fraction = (normalized % divisor)
            .toString()
            .padStart(18, "0")
            .replace(/0+$/, "");

        return `${negative ? "-" : ""}${whole.toString()}${
            fraction === "" ? "" : `.${fraction}`
        }`;
    };

    const zeroPadValue = (value: string, length: number) =>
        `0x${stripPrefix(value).padStart(length * 2, "0")}`;
    const getBytes = (value: string) =>
        Uint8Array.from(Buffer.from(stripPrefix(value), "hex"));
    const concat = (values: string[]) =>
        `0x${values.map((value) => stripPrefix(value)).join("")}`;
    const solidityPacked = (types: string[], values: Array<string | bigint>) =>
        `0x${types
            .map((type, index) => {
                if (type.startsWith("uint")) {
                    return toUintHex(
                        values[index] as bigint | number,
                        Number(type.slice(4)) / 8,
                    );
                }

                if (type === "bytes32") {
                    return stripPrefix(
                        zeroPadValue(values[index] as string, 32),
                    );
                }

                throw new Error(`unsupported solidityPacked type: ${type}`);
            })
            .join("")}`;

    return {
        Contract: vi.fn(),
        JsonRpcProvider: vi.fn(),
        FallbackProvider: vi.fn(),
        Signature: {
            from: vi.fn((value: unknown) => value),
        },
        AbiCoder: {
            defaultAbiCoder: () => ({
                encode: vi.fn(() => "0xencoded"),
            }),
        },
        ZeroAddress: "0x0000000000000000000000000000000000000000",
        concat,
        formatEther,
        getBytes,
        keccak256: vi.fn((value: string) => value),
        solidityPacked,
        zeroPadValue,
    };
});
