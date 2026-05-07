import {
    createAssetProvider,
    getRpcUrls,
    requireRpcUrls,
} from "../../src/utils/provider";

vi.mock("../../src/config", () => ({
    config: {
        assets: {
            EMPTY: {
                network: {
                    rpcUrls: [],
                },
            },
            MULTI: {
                network: {
                    rpcUrls: [
                        "https://one.example",
                        "https://two.example",
                        "https://three.example",
                    ],
                },
            },
            SINGLE: {
                network: {
                    rpcUrls: ["https://single.example"],
                },
            },
        },
    },
}));

describe("provider utils", () => {
    test("creates a provider for multi-rpc assets", () => {
        const provider = createAssetProvider("MULTI");
        expect(provider.transport.type).toEqual("fallback");
        expect(
            provider.transport.transports.map(
                (transport: { value: unknown }) => {
                    const value: unknown = transport.value;
                    if (typeof value !== "object" || value === null) {
                        return undefined;
                    }
                    const url = Reflect.get(value, "url");
                    return typeof url === "string" ? url : undefined;
                },
            ),
        ).toEqual([
            "https://one.example",
            "https://two.example",
            "https://three.example",
        ]);

        expect(requireRpcUrls("MULTI")).toEqual([
            "https://one.example",
            "https://two.example",
            "https://three.example",
        ]);
    });

    test("treats empty rpc configuration as unavailable", () => {
        expect(getRpcUrls("EMPTY")).toBeUndefined();
        expect(() => createAssetProvider("EMPTY")).toThrow(
            /missing RPC configuration/,
        );
    });

    test("creates a provider when only one url exists", () => {
        const provider = createAssetProvider("SINGLE");
        expect(provider.transport.type).toEqual("http");
        expect(requireRpcUrls("SINGLE")).toEqual(["https://single.example"]);
    });
});
