import { render } from "@solidjs/testing-library";
import { I18nContext } from "@solid-primitives/i18n";
import { beforeAll, beforeEach, expect, vi } from "vitest";
import createI18n from "../../src/i18n";
import * as signals from "../../src/signals";
import Fees from "../../src/components/Fees";

describe("Fees component", () => {
    const cfg = {
        "BTC/BTC": {
            rate: 1,
            limits: {
                maximal: 10000000,
                minimal: 50000,
                maximalZeroConf: {
                    baseAsset: 0,
                    quoteAsset: 0,
                },
            },
            fees: {
                percentage: 0.5,
                percentageSwapIn: 0.1,
                minerFees: {
                    baseAsset: {
                        normal: 6800,
                        reverse: {
                            claim: 5520,
                            lockup: 6120,
                        },
                    },
                    quoteAsset: {
                        normal: 6800,
                        reverse: {
                            claim: 5520,
                            lockup: 6120,
                        },
                    },
                },
            },
        },
        "L-BTC/BTC": {
            rate: 1,
            limits: {
                maximal: 5000000,
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
                        normal: 6800,
                        reverse: {
                            claim: 5520,
                            lockup: 6120,
                        },
                    },
                },
            },
        },
    };

    beforeAll(() => {
        signals.setConfig(cfg);
        signals.setReverse(true);
    });

    beforeEach(() => {
        signals.setAsset("BTC");
    });

    test("should render", async () => {
        const setMinimum = vi.spyOn(signals, "setMinimum");

        render(() => {
            <I18nContext.Provider value={createI18n()}>
                <Fees />
            </I18nContext.Provider>;
        });

        expect(setMinimum).toHaveBeenCalledTimes(2);
        expect(setMinimum).toHaveBeenCalledWith(cfg["BTC/BTC"].limits.minimal);
    });

    test("should update send amount on asset change", async () => {
        const setSendAmount = vi.spyOn(signals, "setSendAmount");

        render(() => {
            <I18nContext.Provider value={createI18n()}>
                <Fees />
            </I18nContext.Provider>;
        });

        expect(setSendAmount).toHaveBeenCalledWith(61950);

        signals.setAsset("L-BTC");

        expect(setSendAmount).toHaveBeenLastCalledWith(50555);
    });

    test("should update send amount on miner fee change", async () => {
        const setSendAmount = vi.spyOn(signals, "setSendAmount");

        render(() => {
            <I18nContext.Provider value={createI18n()}>
                <Fees />
            </I18nContext.Provider>;
        });

        expect(setSendAmount).toHaveBeenCalledWith(61950);

        const updatedCfg = { ...cfg };
        cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
        signals.setConfig(updatedCfg);

        expect(setSendAmount).toHaveBeenLastCalledWith(61950 + 1);
    });
});
