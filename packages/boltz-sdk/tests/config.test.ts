import {
    _resetForTesting,
    getConfig,
    init,
} from "../src/public/config";
import { ConfigError, NotInitializedError } from "../src/public/errors";

describe("config lifecycle", () => {
    beforeEach(() => {
        _resetForTesting();
    });

    test("getConfig throws NotInitializedError before init", () => {
        expect(() => getConfig()).toThrow(NotInitializedError);
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

describe("config validation", () => {
    beforeEach(() => {
        _resetForTesting();
    });

    test("rejects null config", () => {
        expect(() => (init as (c: null) => void)(null)).toThrow(ConfigError);
    });

    test("rejects empty apiUrl", () => {
        expect(() => init({ apiUrl: "" })).toThrow(ConfigError);
        expect(() => init({ apiUrl: "   " })).toThrow(ConfigError);
    });

    test("rejects invalid network", () => {
        expect(() =>
            init({ apiUrl: "http://localhost", network: "invalid" as never }),
        ).toThrow(ConfigError);
    });

    test("accepts valid networks", () => {
        for (const network of ["mainnet", "testnet", "regtest"] as const) {
            _resetForTesting();
            expect(() =>
                init({ apiUrl: "http://localhost", network }),
            ).not.toThrow();
        }
    });

    test("rejects non-positive defaultTimeout", () => {
        expect(() =>
            init({ apiUrl: "http://localhost", defaultTimeout: 0 }),
        ).toThrow(ConfigError);
        expect(() =>
            init({ apiUrl: "http://localhost", defaultTimeout: -100 }),
        ).toThrow(ConfigError);
    });

    test("accepts valid defaultTimeout", () => {
        expect(() =>
            init({ apiUrl: "http://localhost", defaultTimeout: 5000 }),
        ).not.toThrow();
    });

    test("accepts apiUrl as getter function", () => {
        expect(() => init({ apiUrl: () => "http://localhost" })).not.toThrow();
    });

    test("validates getter function return value", () => {
        expect(() =>
            init({ apiUrl: (() => "") as () => string }),
        ).toThrow(ConfigError);
    });
});
