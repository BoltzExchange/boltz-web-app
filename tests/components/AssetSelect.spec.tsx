import { fireEvent, render, screen } from "@solidjs/testing-library";

import SelectAsset from "../../src/components/AssetSelect";
import { BTC, LBTC, LN, sideReceive, sideSend } from "../../src/consts";
import { useCreateContext } from "../../src/context/Create";
import i18n from "../../src/i18n/i18n";
import { contextWrapper } from "../helper";

describe("AssetSelect", () => {
    let signals: any;

    const TestComponent = () => {
        signals = useCreateContext();
        return "";
    };

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
        signals.setAssetSelected(sideSend);

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
        ${sideSend}
        ${sideReceive}
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
                side === sideSend ? i18n.en.send : i18n.en.receive,
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
        signals.setAssetSelected(sideSend);

        const setAsset = jest.spyOn(signals, "setAsset");
        const setAssetSend = jest.spyOn(signals, "setAssetSend");
        const setAssetReceive = jest.spyOn(signals, "setAssetReceive");

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
            render(
                () => (
                    <>
                        <TestComponent />
                        <SelectAsset />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setAsset(prevAsset);
            signals.setAssetSelect(true);
            signals.setAssetSelected(side);
            signals.setAssetSend(prevSend);
            signals.setAssetReceive(prevReceive);

            fireEvent.click(await screen.findByTestId(`select-${newAsset}`));

            expect(signals.asset()).toEqual(asset);

            const isSend = side === sideSend;
            expect(
                isSend ? signals.assetSend() : signals.assetReceive(),
            ).toEqual(newAsset);
            expect(
                !isSend ? signals.assetSend() : signals.assetReceive(),
            ).toEqual(expectedOther);
        },
    );
});
