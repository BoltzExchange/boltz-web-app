import { fireEvent, render, screen } from "@solidjs/testing-library";

import SelectAsset from "../../src/components/AssetSelect";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { Side } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import Pair from "../../src/utils/Pair";
import { TestComponent, contextWrapper, signals } from "../helper";
import { pairs } from "../pairs";

vi.mock("../../src/utils/boltzClient", () => ({
    getPairs: vi.fn(() => Promise.resolve(pairs)),
}));

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

describe("AssetSelect", () => {
    test.each`
        asset
        ${LN}
        ${BTC}
        ${LBTC}
    `("should highlight selected asset $asset", async ({ asset }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        setPairAssets(asset, asset === BTC ? LN : BTC);
        signals.setAssetSelect(true);
        signals.setAssetSelected(Side.Send);

        for (const a of [LN, BTC, LBTC]) {
            const elem = await screen.findByTestId(`select-${a}`);
            expect(elem.getAttribute("data-selected")).toEqual(
                String(a === asset),
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

    test("should ignore same asset selection", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        setPairAssets(BTC, LN);
        signals.setAssetSelect(true);
        signals.setAssetSelected(Side.Send);

        const setPair = vi.spyOn(signals, "setPair");

        fireEvent.click(await screen.findByTestId(`select-${BTC}`));

        expect(setPair).toHaveBeenCalledTimes(0);
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
            setPairAssets(prevSend, prevReceive);

            fireEvent.click(await screen.findByTestId(`select-${newAsset}`));

            const isSend = side === Side.Send;
            expect(
                isSend ? signals.pair().fromAsset : signals.pair().toAsset,
            ).toEqual(newAsset);
            expect(
                !isSend ? signals.pair().fromAsset : signals.pair().toAsset,
            ).toEqual(expectedOther);
        },
    );

    test.each`
        asset   | newAsset | address
        ${BTC}  | ${LBTC}  | ${"bcrt1qarpsq5wx9j75r8uh806c2l3rd3x083wrdtzhea"}
        ${LBTC} | ${BTC}   | ${"el1qqgdvkht3g2puwdwxqzfrekef8anygnvs093hntsz63f42gj5m0zksfvvvsss79pv7le474snv6n2slklg7ujvth99naldh9cy"}
    `(
        "should not clear onchain address, when assetReceive did not change",
        async ({ asset, newAsset, address }) => {
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
            setPairAssets(LN, asset);

            fireEvent.click(await screen.findByTestId(`select-${newAsset}`));

            expect(signals.pair().fromAsset).toEqual(newAsset);
            expect(signals.onchainAddress()).toEqual(address);
        },
    );

    test("should clear onchain address when assetReceive changes", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const initialAddress =
            "el1qqgdvkht3g2puwdwxqzfrekef8anygnvs093hntsz63f42gj5m0zksfvvvsss79pv7le474snv6n2slklg7ujvth99naldh9cy";

        signals.setOnchainAddress(initialAddress);
        signals.setAssetSelect(true);
        signals.setAssetSelected(Side.Receive);
        setPairAssets(BTC, LBTC);

        fireEvent.click(await screen.findByTestId(`select-${BTC}`));

        expect(signals.pair().toAsset).toEqual(BTC);
        expect(signals.onchainAddress()).toBe("");
    });
});
