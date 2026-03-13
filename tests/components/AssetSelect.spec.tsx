import { fireEvent, render, screen } from "@solidjs/testing-library";

import SelectAsset from "../../src/components/AssetSelect";
import NetworkSelect from "../../src/components/NetworkSelect";
import type * as ConfigModule from "../../src/config";
import { config } from "../../src/config";
import { BTC, LBTC, LN, USDT0, isUsdt0Variant } from "../../src/consts/Assets";
import { AssetSelection, Side } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import Pair from "../../src/utils/Pair";
import { TestComponent, contextWrapper, signals } from "../helper";
import { pairs } from "../pairs";

vi.mock("../../src/utils/boltzClient", () => ({
    getPairs: vi.fn(() => Promise.resolve(pairs)),
}));

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: {
            ...actual.config,
            assets: {
                ...actual.config.assets,
                "USDT0-ETH": {
                    ...actual.config.assets.USDT0,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Ethereum",
                        symbol: "ETH",
                        gasToken: "ETH",
                        chainId: 1,
                        nativeCurrency: {
                            name: "ETH",
                            symbol: "ETH",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000000001",
                    },
                },
                "USDT0-OP": {
                    ...actual.config.assets.USDT0,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Optimism",
                        symbol: "OP",
                        gasToken: "OP",
                        chainId: 10,
                        nativeCurrency: {
                            name: "OP",
                            symbol: "OP",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000000002",
                    },
                },
            },
        },
    };
});

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

const usdt0VariantAssets = Object.keys(config.assets).filter((asset) =>
    isUsdt0Variant(asset),
);

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
        signals.setAssetSelection(AssetSelection.Asset);
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

        signals.setAssetSelection(AssetSelection.Asset);
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
        signals.setAssetSelection(AssetSelection.Asset);
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

            signals.setAssetSelection(AssetSelection.Asset);
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
            signals.setAssetSelection(AssetSelection.Asset);
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
        signals.setAssetSelection(AssetSelection.Asset);
        signals.setAssetSelected(Side.Receive);
        setPairAssets(BTC, LBTC);

        fireEvent.click(await screen.findByTestId(`select-${BTC}`));

        expect(signals.pair().toAsset).toEqual(BTC);
        expect(signals.onchainAddress()).toBe("");
    });

    describe("USDT0 multi-step selection", () => {
        const openAssetSelect = () => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <SelectAsset />
                        <NetworkSelect />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setAssetSelection(AssetSelection.Asset);
            signals.setAssetSelected(Side.Send);
        };

        test("should not show USDT0 variants in asset list", async () => {
            openAssetSelect();

            await screen.findByTestId(`select-${USDT0}`);

            for (const variant of usdt0VariantAssets) {
                expect(screen.queryByTestId(`select-${variant}`)).toBeNull();
            }
        });

        test("should show single USDT0 entry in asset list", async () => {
            openAssetSelect();

            const entry = await screen.findByTestId(`select-${USDT0}`);
            expect(entry).toBeDefined();
        });

        test("should show network selection when clicking USDT0", async () => {
            openAssetSelect();

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));

            expect(
                await screen.findByText(i18n.en.select_network),
            ).toBeDefined();
        });

        test("should show all USDT0 networks in step 2", async () => {
            openAssetSelect();

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));
            await screen.findByText(i18n.en.select_network);

            expect(screen.queryByTestId(`select-${USDT0}`)).not.toBeNull();

            for (const variant of usdt0VariantAssets) {
                expect(
                    screen.queryByTestId(`select-${variant}`),
                ).not.toBeNull();
            }
        });

        test("should return to asset list when clicking back", async () => {
            openAssetSelect();

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));
            await screen.findByTestId("network-back");

            fireEvent.click(screen.getByTestId("network-back"));

            expect(await screen.findByTestId(`select-${BTC}`)).toBeDefined();
            expect(screen.queryByTestId("network-back")).toBeNull();
        });

        test("should filter networks with search", async () => {
            openAssetSelect();

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));
            await screen.findByText(i18n.en.select_network);

            const searchInput = screen.getByPlaceholderText(i18n.en.search);
            fireEvent.input(searchInput, { target: { value: "Arb" } });

            expect(screen.queryByTestId("select-USDT0")).not.toBeNull(); // Arbitrum
            expect(screen.queryByTestId("select-USDT0-BERA")).toBeNull();
        });

        test("should clear search when clicking clear button", async () => {
            openAssetSelect();

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));
            await screen.findByText(i18n.en.select_network);

            const searchInput = screen.getByPlaceholderText(i18n.en.search);
            fireEvent.input(searchInput, { target: { value: "Eth" } });

            fireEvent.click(screen.getByTestId("search-clear"));

            expect((searchInput as HTMLInputElement).value).toBe("");
            for (const variant of usdt0VariantAssets) {
                expect(
                    screen.queryByTestId(`select-${variant}`),
                ).not.toBeNull();
            }
        });

        test("should reset to step 1 when closing and reopening", async () => {
            openAssetSelect();

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));
            await screen.findByTestId("network-back");

            fireEvent.click(screen.getByTestId("network-close"));

            signals.setAssetSelection(AssetSelection.Asset);

            expect(await screen.findByTestId(`select-${BTC}`)).toBeDefined();
            expect(screen.queryByTestId("network-back")).toBeNull();
        });

        test("should keep the active network focused when opening step 2", async () => {
            openAssetSelect();
            setPairAssets("USDT0-OP", BTC);

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));

            const searchInput = await screen.findByPlaceholderText(
                i18n.en.search,
            );
            fireEvent.keyDown(searchInput, { key: "Enter" });

            expect(signals.pair().fromAsset).toEqual("USDT0-OP");
            expect(screen.queryByTestId("network-back")).toBeNull();
        });
    });
});
