import { render } from "@solidjs/testing-library";
import { I18nContext } from "@solid-primitives/i18n";
import { beforeAll, beforeEach, expect, vi } from "vitest";
import { cfg } from "../config";
import createI18n from "../../src/i18n";
import * as signals from "../../src/signals";
import Fees from "../../src/components/Fees";
import { calculateSendAmount } from "../../src/utils/calculate";

describe("Fees component", () => {
    beforeAll(() => {
        signals.setConfig(cfg);
        signals.setReverse(true);
    });

    beforeEach(() => {
        signals.setAsset("BTC");
    });

    test("should render", async () => {
        render(() => {
            <I18nContext.Provider value={createI18n()}>
                <Fees />
            </I18nContext.Provider>;
        });
    });

    test("should recalculate limits on direction switch", () => {
        const setMinimum = vi.spyOn(signals, "setMinimum");
        const setMaximum = vi.spyOn(signals, "setMaximum");

        render(() => {
            <I18nContext.Provider value={createI18n()}>
                <Fees />
            </I18nContext.Provider>;
        });

        expect(setMinimum).toHaveBeenCalledWith(cfg["BTC/BTC"].limits.minimal);
        expect(setMaximum).toHaveBeenCalledWith(cfg["BTC/BTC"].limits.maximal);

        signals.setReverse(false);

        expect(setMinimum).toHaveBeenLastCalledWith(
            calculateSendAmount(cfg["BTC/BTC"].limits.minimal),
        );
        expect(setMaximum).toHaveBeenLastCalledWith(
            calculateSendAmount(cfg["BTC/BTC"].limits.maximal),
        );
    });
});
