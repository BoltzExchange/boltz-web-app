import { describe, test, expect } from "vitest";
import { I18nContext } from "@solid-primitives/i18n";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import i18n from "../../src/i18n/i18n";
import createI18n from "../../src/i18n";
import * as signals from "../../src/signals";
import SelectAsset from "../../src/components/AssetSelect";
import { BTC, LBTC, LN, sideReceive, sideSend } from "../../src/consts";

describe("AssetSelect", () => {
    test.each`
        asset
        ${LN}
        ${BTC}
        ${LBTC}
    `("should highlight selected asset $asset", ({ asset }) => {
        signals.setAssetSend(asset);
        signals.setAssetSelect(true);
        signals.setAssetSelected(sideSend);

        const res = render(() => (
            <I18nContext.Provider value={createI18n()}>
                <SelectAsset />
            </I18nContext.Provider>
        ));

        for (const elem of res.container.children[0].children) {
            const classes = Array.from(elem.classList.values());
            if (!classes.includes("asset-select")) {
                continue;
            }

            expect(elem.getAttribute("data-selected")).toEqual(
                String(classes[1].substring(6) === asset)
            );
        }
    });

    test.each`
        side
        ${sideSend}
        ${sideReceive}
    `("should set header text for $side", async ({ side }) => {
        signals.setAssetSelect(true);
        signals.setAssetSelected(side);

        render(() => (
            <I18nContext.Provider value={createI18n()}>
                <SelectAsset />
            </I18nContext.Provider>
        ));

        const header = await screen.findByText(
            i18n.en.select_asset.replace(
                "{{ direction }}",
                side === sideSend ? i18n.en.send : i18n.en.receive
            )
        );
        expect(header).not.toBeUndefined();
    });

    test("should ignore same asset selection", () => {
        signals.setAssetSend(BTC);
        signals.setAssetSelect(true);
        signals.setAssetSelected(sideSend);

        const setAsset = vi.spyOn(signals, "setAsset");
        const setAssetSend = vi.spyOn(signals, "setAssetSend");
        const setAssetReceive = vi.spyOn(signals, "setAssetReceive");

        const { container } = render(() => (
            <I18nContext.Provider value={createI18n()}>
                <SelectAsset />
            </I18nContext.Provider>
        ));

        const btcButton = container.children[0].children[3];
        fireEvent.click(btcButton);

        expect(setAsset).toHaveBeenCalledTimes(0);
        expect(setAssetSend).toHaveBeenCalledTimes(0);
        expect(setAssetReceive).toHaveBeenCalledTimes(0);
    });

    test.each`
        side           | newAsset | asset   | expectedOther | prevSend | prevReceive | prevAsset
        ${sideSend}    | ${BTC}   | ${BTC}  | ${LN}         | ${LBTC}  | ${LN}       | ${LBTC}
        ${sideSend}    | ${LBTC}  | ${LBTC} | ${LN}         | ${BTC}   | ${LN}       | ${BTC}
        ${sideSend}    | ${BTC}   | ${BTC}  | ${LN}         | ${LN}    | ${BTC}      | ${BTC}
        ${sideReceive} | ${LN}    | ${BTC}  | ${BTC}        | ${LN}    | ${BTC}      | ${BTC}
        ${sideReceive} | ${LBTC}  | ${LBTC} | ${LN}         | ${LN}    | ${BTC}      | ${BTC}
    `(
        "should change $side asset to $newAsset (prev $prevSend -> $prevReceive)",
        async ({
            side,
            asset,
            newAsset,
            prevSend,
            prevAsset,
            prevReceive,
            expectedOther,
        }) => {
            signals.setAsset(prevAsset);
            signals.setAssetSelect(true);
            signals.setAssetSelected(side);
            signals.setAssetSend(prevSend);
            signals.setAssetReceive(prevReceive);

            render(() => (
                <I18nContext.Provider value={createI18n()}>
                    <SelectAsset />
                </I18nContext.Provider>
            ));
            fireEvent.click(await screen.findByTestId(`select-${newAsset}`));

            expect(signals.asset()).toEqual(asset);

            const isSend = side === sideSend;
            expect(
                isSend ? signals.assetSend() : signals.assetReceive()
            ).toEqual(newAsset);
            expect(
                !isSend ? signals.assetSend() : signals.assetReceive()
            ).toEqual(expectedOther);
        }
    );
});
