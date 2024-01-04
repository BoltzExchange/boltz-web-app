import { render } from "@solidjs/testing-library";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import Fees from "../../src/components/Fees";
import * as signals from "../../src/signals";
import { calculateSendAmount } from "../../src/utils/calculate";
import { cfg } from "../config";

describe("Fees component", () => {
    beforeAll(() => {
        signals.setConfig(cfg);
        signals.setReverse(true);
    });

    beforeEach(() => {
        signals.setAsset("BTC");
    });

    test("should render", async () => {
        render(() => <Fees />);
    });

    test("should recalculate limits on direction switch", () => {
        const setMinimum = vi.spyOn(signals, "setMinimum");
        const setMaximum = vi.spyOn(signals, "setMaximum");

        render(() => <Fees />);

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
