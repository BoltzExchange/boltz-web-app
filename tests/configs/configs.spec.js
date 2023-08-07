import { describe, expect } from "vitest";
import * as regtest from "../../src/configs/config.regtest";
import * as testnet from "../../src/configs/config.testnet";
import * as mainnet from "../../src/configs/config.mainnet";

describe("configs", () => {
    test.each`
        name         | config
        ${"mainnet"} | ${mainnet}
        ${"testnet"} | ${testnet}
        ${"regtest"} | ${regtest}
    `("$name should have all pairs configured", ({ config }) => {
        expect(Object.keys(config.pairs).sort()).toEqual([
            "BTC/BTC",
            "L-BTC/BTC",
        ]);
        for (const pair of Object.values(config.pairs)) {
            expect(pair.apiUrl).not.toBeUndefined();
            expect(pair.blockExplorerUrl).not.toBeUndefined();
        }
    });
});
