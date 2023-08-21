import { Router } from "@solidjs/router";
import { I18nContext } from "@solid-primitives/i18n";
import { render, screen } from "@solidjs/testing-library";
import { beforeAll, beforeEach, expect, vi } from "vitest";
import { cfg } from "../config";
import Create from "../../src/Create";
import i18n from "../../src/i18n/i18n";
import createI18n from "../../src/i18n";
import * as signals from "../../src/signals";

describe("Create", () => {
    beforeAll(() => {
        signals.setConfig(cfg);
        signals.setMinimum(cfg["BTC/BTC"].limits.minimal);
        signals.setReverse(true);
    });

    beforeEach(() => {
        signals.setAsset("BTC");
    });

    test("should render Create", async () => {
        render(() => (
            <I18nContext.Provider value={createI18n()}>
                <Router>
                    <Create />
                </Router>
            </I18nContext.Provider>
        ));
        const button = await screen.findAllByText(i18n.en.create_swap);
        expect(button).not.toBeUndefined();
    });

    test("should update receive amount on asset change", async () => {
        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        render(() => {
            <I18nContext.Provider value={createI18n()}>
                <Router>
                    <Create />
                </Router>
            </I18nContext.Provider>;
        });

        signals.setSendAmount(50_000n);

        // To force trigger a recalculation
        signals.setAsset("L-BTC");
        signals.setAsset("BTC");

        expect(setReceiveAmount).toHaveBeenCalledWith(38110n);

        signals.setAsset("L-BTC");

        expect(setReceiveAmount).toHaveBeenLastCalledWith(49447n);
    });

    test("should update receive amount on miner fee change", async () => {
        const setReceiveAmount = vi.spyOn(signals, "setReceiveAmount");

        render(() => {
            <I18nContext.Provider value={createI18n()}>
                <Router>
                    <Create />
                </Router>
            </I18nContext.Provider>;
        });

        expect(setReceiveAmount).toHaveBeenCalledWith(38110n);

        const updatedCfg = { ...cfg };
        cfg["BTC/BTC"].fees.minerFees.baseAsset.reverse.claim += 1;
        signals.setConfig(updatedCfg);

        expect(setReceiveAmount).toHaveBeenLastCalledWith(38110n - 1n);
    });
});
