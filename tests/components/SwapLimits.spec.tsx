import { fireEvent, render } from "@solidjs/testing-library";

import SwapLimits from "../../src/components/SwapLimits";
import type * as ConfigModule from "../../src/config";
import type * as MainnetConfigModule from "../../src/configs/mainnet";
import { Denomination } from "../../src/consts/Enums";

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");
    const mainnet = await vi.importActual<typeof MainnetConfigModule>(
        "../../src/configs/mainnet",
    );

    return {
        ...actual,
        config: mainnet.config,
    };
});

describe("SwapLimits", () => {
    test("renders USDT icons for USDT0 assets and selects both limits", () => {
        const onSelectAmount = vi.fn();
        const { container } = render(() => (
            <SwapLimits
                asset="USDT0-SOL"
                denomination={Denomination.Btc}
                maximum={2_000_000}
                maximumLabel="Max"
                minimum={1_000_000}
                minimumLabel="Min"
                onSelectAmount={onSelectAmount}
                sendLabel="Send"
                separator="."
            />
        ));

        expect(
            container.querySelectorAll('.denominator[data-denominator="USDT"]'),
        ).toHaveLength(2);

        const buttons = container.querySelectorAll(".btn-small");
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[1]);

        expect(onSelectAmount).toHaveBeenNthCalledWith(1, 1_000_000);
        expect(onSelectAmount).toHaveBeenNthCalledWith(2, 2_000_000);
    });
});
