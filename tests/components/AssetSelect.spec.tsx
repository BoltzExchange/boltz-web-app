import { fireEvent, render, screen } from "@solidjs/testing-library";

import SelectAsset from "../../src/components/AssetSelect";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { Side } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import { TestComponent, contextWrapper, signals } from "../helper";

describe("AssetSelect", () => {
    test.each`
        asset
        ${LN}
        ${BTC}
        ${LBTC}
    `("should highlight selected asset $asset", ({ asset }) => {
        const res = render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        signals.setAssetSend(asset);
        signals.setAssetSelect(true);
        signals.setAssetSelected(Side.Send);

        for (const elem of res.container.children[0].children) {
            const classes = Array.from(elem.classList.values());
            if (!classes.includes("asset-select")) {
                continue;
            }

            expect(elem.getAttribute("data-selected")).toEqual(
                String(classes[1].substring(6) === asset),
            );
        }
    });

    test.each`
        side
        ${Side.Send}
        ${Side.Receive}
    `("should set header text for $side", async ({ side }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        signals.setAssetSelect(true);
        signals.setAssetSelected(side);

        const header = await screen.findByText(
            i18n.en.select_asset.replace(
                "{{ direction }}",
                side === Side.Send ? i18n.en.send : i18n.en.receive,
            ),
        );
        expect(header).not.toBeUndefined();
    });

    test("should ignore same asset selection", () => {
        const { container } = render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        signals.setAssetSend(BTC);
        signals.setAssetSelect(true);
        signals.setAssetSelected(Side.Send);

        const setAssetSend = jest.spyOn(signals, "setAssetSend");
        const setAssetReceive = jest.spyOn(signals, "setAssetReceive");

        const btcButton = container.children[0].children[3];
        fireEvent.click(btcButton);

        expect(setAssetSend).toHaveBeenCalledTimes(0);
        expect(setAssetReceive).toHaveBeenCalledTimes(0);
    });

    test.each`
        side            | newAsset | expectedOther | prevSend | prevReceive
        ${Side.Send}    | ${BTC}   | ${LN}         | ${LBTC}  | ${LN}
        ${Side.Send}    | ${LBTC}  | ${LN}         | ${BTC}   | ${LN}
        ${Side.Send}    | ${BTC}   | ${LN}         | ${LN}    | ${BTC}
        ${Side.Receive} | ${LN}    | ${BTC}        | ${LN}    | ${BTC}
        ${Side.Receive} | ${LBTC}  | ${LN}         | ${LN}    | ${BTC}
    `(
        "should change $side asset to $newAsset (prev $prevSend -> $prevReceive)",
        async ({ side, newAsset, prevSend, prevReceive, expectedOther }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <SelectAsset />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setAssetSelect(true);
            signals.setAssetSelected(side);
            signals.setAssetSend(prevSend);
            signals.setAssetReceive(prevReceive);

            fireEvent.click(await screen.findByTestId(`select-${newAsset}`));

            const isSend = side === Side.Send;
            expect(
                isSend ? signals.assetSend() : signals.assetReceive(),
            ).toEqual(newAsset);
            expect(
                !isSend ? signals.assetSend() : signals.assetReceive(),
            ).toEqual(expectedOther);
        },
    );

    test.each`
        address
        ${"bcrt1qarpsq5wx9j75r8uh806c2l3rd3x083wrdtzhea"}
    `(
        "should not clear onchain address, when assetReceive did not change",
        async ({ address }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <SelectAsset />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setOnchainAddress(address);
            signals.setAssetSelect(true);
            signals.setAssetSelected(Side.Send);
            signals.setAssetSend(LN);
            signals.setAssetReceive(BTC);

            fireEvent.click(await screen.findByTestId(`select-L-BTC`));

            expect(signals.assetSend()).toEqual(LBTC);
            expect(signals.onchainAddress()).toEqual(address);
        },
    );
});
