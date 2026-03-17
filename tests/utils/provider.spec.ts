import {
    FallbackProvider as EthersFallbackProvider,
    JsonRpcProvider,
} from "ethers";

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
    beforeEach(() => {
        vi.mocked(JsonRpcProvider).mockClear();
        vi.mocked(EthersFallbackProvider).mockClear();
    });

    test("creates a fallback provider for multi-rpc assets", () => {
        createAssetProvider("MULTI");

        expect(requireRpcUrls("MULTI")).toEqual([
            "https://one.example",
            "https://two.example",
            "https://three.example",
        ]);
        expect(JsonRpcProvider).toHaveBeenCalledTimes(3);
        expect(JsonRpcProvider).toHaveBeenNthCalledWith(
            1,
            "https://one.example",
        );
        expect(JsonRpcProvider).toHaveBeenNthCalledWith(
            2,
            "https://two.example",
        );
        expect(JsonRpcProvider).toHaveBeenNthCalledWith(
            3,
            "https://three.example",
        );
        expect(EthersFallbackProvider).toHaveBeenCalledTimes(1);
        expect(EthersFallbackProvider).toHaveBeenCalledWith(
            expect.any(Array),
            undefined,
            { quorum: 1 },
        );
    });

    test("treats empty rpc configuration as unavailable", () => {
        expect(getRpcUrls("EMPTY")).toBeUndefined();
        expect(() => createAssetProvider("EMPTY")).toThrow(
            /missing RPC configuration/,
        );
        expect(EthersFallbackProvider).not.toHaveBeenCalled();
    });

    test("creates a single json-rpc provider when only one url exists", () => {
        createAssetProvider("SINGLE");

        expect(JsonRpcProvider).toHaveBeenCalledTimes(1);
        expect(JsonRpcProvider).toHaveBeenCalledWith("https://single.example");
        expect(EthersFallbackProvider).not.toHaveBeenCalled();
    });
});
