import { fireEvent, render, screen } from "@solidjs/testing-library";

import Asset from "../../src/components/Asset";
import { BTC, LN } from "../../src/consts/Assets";
import { AssetSelection, Side } from "../../src/consts/Enums";
import { TestComponent, contextWrapper, signals } from "../helper";

describe("Asset", () => {
    test("should open the asset selector on click when not disabled", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Asset side={Side.Receive} signal={() => BTC} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        fireEvent.click(screen.getByRole("button"));

        expect(signals.assetSelected()).toEqual(Side.Receive);
        expect(signals.assetSelection()).toEqual(AssetSelection.Asset);
    });

    test("should not open the asset selector when disabled", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Asset
                        side={Side.Receive}
                        signal={() => BTC}
                        disabled={true}
                    />
                </>
            ),
            { wrapper: contextWrapper },
        );

        signals.setAssetSelected("");
        signals.setAssetSelection(null);

        fireEvent.click(screen.getByRole("button"));

        expect(signals.assetSelected()).toEqual("");
        expect(signals.assetSelection()).toBeNull();
    });

    test("should set disabled attribute and no-select class when disabled", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Asset
                        side={Side.Receive}
                        signal={() => LN}
                        disabled={true}
                    />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const button = screen.getByRole("button") as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(button.className).toContain("no-select");
    });

    test("should not set disabled attribute or no-select class when enabled", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Asset side={Side.Receive} signal={() => LN} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const button = screen.getByRole("button") as HTMLButtonElement;
        expect(button.disabled).toBe(false);
        expect(button.className).not.toContain("no-select");
    });
});
