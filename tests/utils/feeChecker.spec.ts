import { beforeAll, describe, expect, test } from "vitest";

import { BTC, LBTC } from "../../src/consts";
import { feeChecker } from "../../src/utils/feeChecker";

const cfg = {
    "BTC/BTC": {
        hash: "3c45e394f2cb8b84ceee2a8e51849616a8981a7eab09e5194cd1ab7787b6b12e",
        fees: {
            percentage: 0.5,
            percentageSwapIn: 0.1,
            minerFees: {
                baseAsset: {
                    normal: 1870,
                    reverse: {
                        claim: 1518,
                        lockup: 1683,
                    },
                },
                quoteAsset: {
                    normal: 1870,
                    reverse: {
                        claim: 1518,
                        lockup: 1683,
                    },
                },
            },
        },
    },
    "L-BTC/BTC": {
        hash: "6322db986c4007dd559655fbdebe4a1481822d5965d98adde39d908b8fcd2bf1",
        rate: 1,
        limits: {
            maximal: 4294967,
            minimal: 10000,
            maximalZeroConf: {
                baseAsset: 0,
                quoteAsset: 0,
            },
        },
        fees: {
            percentage: 0.25,
            percentageSwapIn: 0.1,
            minerFees: {
                baseAsset: {
                    normal: 147,
                    reverse: {
                        claim: 152,
                        lockup: 276,
                    },
                },
                quoteAsset: {
                    normal: 3060,
                    reverse: {
                        claim: 2484,
                        lockup: 2754,
                    },
                },
            },
        },
    },
};

const deepCopy = (value: object) => JSON.parse(JSON.stringify(value));

describe("feeChecker", () => {
    test("same config should be valid", () => {
        expect(feeChecker(cfg, cfg, BTC)).toEqual(true);
    });

    test.each`
        fee                   | newValue
        ${"percentage"}       | ${1}
        ${"percentageSwapIn"} | ${1}
    `("should handle changed $fee fee", ({ fee, newValue }) => {
        const changedCfg = deepCopy(cfg);
        changedCfg["BTC/BTC"].fees[fee] = newValue;
        expect(feeChecker(cfg, changedCfg, BTC)).toEqual(false);
    });

    test("should ignore irrelevant miner fee", () => {
        const changedCfg = deepCopy(cfg);
        changedCfg["L-BTC/BTC"].fees.minerFees.quoteAsset.normal += 1;
        expect(feeChecker(cfg, changedCfg, LBTC)).toEqual(true);
    });

    test("should handle relevant miner fee", () => {
        const changedCfg = deepCopy(cfg);
        changedCfg["L-BTC/BTC"].fees.minerFees.baseAsset.normal += 1;
        expect(feeChecker(cfg, changedCfg, LBTC)).toEqual(false);
    });
});
