import { getConfig, init } from "../src/public/config";

describe("config lifecycle", () => {
    // Reset the singleton between tests by re-initialising with null
    // (we cheat via the module internals — init sets the global)
    beforeEach(() => {
        // Force uninitialised state by calling init with null cast
        // This is intentional: we want to test the guard
        (init as (c: null) => void)(null);
    });

    test("getConfig throws before init is called", () => {
        expect(() => getConfig()).toThrow(
            "boltz-sdk not initialized. Call init() before using SDK functions.",
        );
    });

    test("getConfig returns config after init", () => {
        const config = {
            apiUrl: "https://api.boltz.exchange",
            network: "mainnet" as const,
        };
        init(config);
        expect(getConfig()).toBe(config);
    });

    test("init overwrites previous config", () => {
        init({ apiUrl: "http://first" });
        init({ apiUrl: "http://second" });
        expect(getConfig().apiUrl).toBe("http://second");
    });

    test("config preserves all fields", () => {
        const config = {
            apiUrl: "http://localhost:9001",
            network: "regtest" as const,
            referralId: "myapp",
            cooperativeDisabled: false,
            defaultTimeout: 5000,
        };
        init(config);
        const result = getConfig();
        expect(result.apiUrl).toBe(config.apiUrl);
        expect(result.network).toBe(config.network);
        expect(result.referralId).toBe(config.referralId);
        expect(result.cooperativeDisabled).toBe(config.cooperativeDisabled);
        expect(result.defaultTimeout).toBe(config.defaultTimeout);
    });

    test("config supports getter functions", () => {
        let url = "http://first";
        init({ apiUrl: () => url });
        const config = getConfig();
        expect((config.apiUrl as () => string)()).toBe("http://first");
        url = "http://second";
        expect((config.apiUrl as () => string)()).toBe("http://second");
    });

    test("re-init after getConfig works", () => {
        init({ apiUrl: "http://one" });
        expect(getConfig().apiUrl).toBe("http://one");
        init({ apiUrl: "http://two" });
        expect(getConfig().apiUrl).toBe("http://two");
    });
});

