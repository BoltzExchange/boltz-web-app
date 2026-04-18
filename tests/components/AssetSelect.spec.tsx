import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import SelectAsset from "../../src/components/AssetSelect";
import NetworkSelect from "../../src/components/NetworkSelect";
import type * as ConfigModule from "../../src/config";
import { config } from "../../src/config";
import { BTC, LBTC, LN, RBTC, TBTC, USDT0 } from "../../src/consts/Assets";
import { AssetSelection, Side } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs } from "../pairs";
import {
    getSendableUsdt0VariantAssets,
    getUnsendableUsdt0VariantAssets,
    getUsdt0Variants,
    setPairAssets,
} from "./selectTestUtils";

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
                RBTC: {
                    ...actual.config.assets.RBTC,
                    canSend: false,
                },
                TBTC: {
                    ...actual.config.assets.TBTC,
                    disabled: true,
                },
                "USDT0-ETH": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
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
                    canSend: true,
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
                "USDT0-POL": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Polygon PoS",
                        symbol: "POL",
                        gasToken: "POL",
                        chainId: 137,
                        nativeCurrency: {
                            name: "POL",
                            symbol: "POL",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000000004",
                    },
                },
                "USDT0-CFX": {
                    ...actual.config.assets.USDT0,
                    canSend: false,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Conflux eSpace",
                        symbol: "CFX",
                        gasToken: "CFX",
                        chainId: 1030,
                        nativeCurrency: {
                            name: "CFX",
                            symbol: "CFX",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000000003",
                    },
                },
            },
        },
    };
});

afterEach(() => {
    localStorage.clear();
});

const usdt0VariantAssets = getUsdt0Variants(config.assets);
const sendableUsdt0VariantAssets = getSendableUsdt0VariantAssets(config.assets);
const unsendableUsdt0VariantAssets = getUnsendableUsdt0VariantAssets(
    config.assets,
);
const evmAddress = "0x5000000000000000000000000000000000000000";

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

    test("should render assets in configured order", async () => {
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
        signals.setAssetSelected(Side.Receive);

        await screen.findByTestId(`select-${USDT0}`);

        const assetIds = Array.from(
            document.querySelectorAll(
                ".asset-select-list [data-testid^='select-']",
            ),
        ).map((element) => element.getAttribute("data-testid"));

        expect(assetIds).toEqual([
            `select-${LN}`,
            `select-${BTC}`,
            `select-${LBTC}`,
            `select-${RBTC}`,
            `select-${TBTC}`,
            `select-${USDT0}`,
        ]);
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

    test.each`
        asset
        ${RBTC}
        ${"USDT0-ETH"}
        ${"USDT0-POL"}
    `(
        "should not clear EVM-style destination when only send asset changes for $asset",
        async ({ asset }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <SelectAsset />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setOnchainAddress(evmAddress);
            signals.setAddressValid(true);
            signals.setAssetSelection(AssetSelection.Asset);
            signals.setAssetSelected(Side.Send);
            setPairAssets(LN, asset);

            fireEvent.click(await screen.findByTestId(`select-${BTC}`));

            expect(signals.pair().fromAsset).toEqual(BTC);
            expect(signals.pair().toAsset).toEqual(asset);
            expect(signals.onchainAddress()).toEqual(evmAddress);
        },
    );

    test("should hide unsendable assets when selecting send asset", async () => {
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
        signals.setAssetSelected(Side.Send);

        await screen.findByTestId(`select-${BTC}`);

        expect(screen.queryByTestId(`select-${RBTC}`)).toBeNull();
    });

    test("should still show unsendable assets when selecting receive asset", async () => {
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
        signals.setAssetSelected(Side.Receive);

        expect(await screen.findByTestId(`select-${RBTC}`)).toBeDefined();
    });

    test("should mark disabled assets as disabled in the list", async () => {
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
        signals.setAssetSelected(Side.Receive);

        const entry = (await screen.findByTestId(
            `select-${TBTC}`,
        )) as HTMLButtonElement;

        expect(entry.disabled).toBe(true);
        expect(entry.getAttribute("data-disabled")).toEqual("true");
    });

    test("should ignore clicks on disabled assets", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        setPairAssets(LN, BTC);
        signals.setAssetSelection(AssetSelection.Asset);
        signals.setAssetSelected(Side.Receive);

        const setPair = vi.spyOn(signals, "setPair");

        fireEvent.click(await screen.findByTestId(`select-${TBTC}`));

        expect(setPair).not.toHaveBeenCalled();
        expect(signals.pair().toAsset).toEqual(BTC);
        expect(signals.assetSelection()).toEqual(AssetSelection.Asset);
    });

    test("should focus the next enabled asset when the selected asset is disabled", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        setPairAssets(LN, TBTC);
        signals.setAssetSelection(AssetSelection.Asset);
        signals.setAssetSelected(Side.Receive);

        await screen.findByTestId(`select-${USDT0}`);

        await waitFor(() => {
            expect(
                screen
                    .getByTestId(`select-${USDT0}`)
                    .getAttribute("data-focused"),
            ).toEqual("true");
        });
        expect(
            screen.getByTestId(`select-${TBTC}`).getAttribute("data-focused"),
        ).not.toEqual("true");
    });

    test("should skip disabled assets during keyboard navigation", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        setPairAssets(LN, RBTC);
        signals.setAssetSelection(AssetSelection.Asset);
        signals.setAssetSelected(Side.Receive);

        await screen.findByTestId(`select-${USDT0}`);

        await waitFor(() => {
            expect(
                screen
                    .getByTestId(`select-${RBTC}`)
                    .getAttribute("data-focused"),
            ).toEqual("true");
        });

        const modal = document.querySelector(".asset-select-modal");
        expect(modal).not.toBeNull();

        fireEvent.keyDown(modal as HTMLDivElement, { key: "ArrowDown" });

        await waitFor(() => {
            expect(
                screen
                    .getByTestId(`select-${USDT0}`)
                    .getAttribute("data-focused"),
            ).toEqual("true");
        });
        expect(
            screen.getByTestId(`select-${TBTC}`).getAttribute("data-focused"),
        ).not.toEqual("true");
    });

    test("should not render when bitcoinOnly is true", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SelectAsset />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setBitcoinOnly(true);
        signals.setAssetSelection(AssetSelection.Asset);

        expect(screen.queryByTestId(`select-${BTC}`)).toBeNull();
    });

    describe("USDT0 multi-step selection", () => {
        const openAssetSelect = (side = Side.Send) => {
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
            signals.setAssetSelected(side);
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

        test("should hide unsendable USDT0 networks in step 2 for send selection", async () => {
            openAssetSelect();

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));
            await screen.findByText(i18n.en.select_network);

            expect(screen.queryByTestId(`select-${USDT0}`)).not.toBeNull();

            for (const variant of sendableUsdt0VariantAssets) {
                expect(
                    screen.queryByTestId(`select-${variant}`),
                ).not.toBeNull();
            }

            for (const variant of unsendableUsdt0VariantAssets) {
                expect(screen.queryByTestId(`select-${variant}`)).toBeNull();
            }
        });

        test("should still show unsendable USDT0 networks in step 2 for receive selection", async () => {
            openAssetSelect(Side.Receive);

            fireEvent.click(await screen.findByTestId(`select-${USDT0}`));
            await screen.findByText(i18n.en.select_network);

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
            for (const variant of sendableUsdt0VariantAssets) {
                expect(
                    screen.queryByTestId(`select-${variant}`),
                ).not.toBeNull();
            }

            for (const variant of unsendableUsdt0VariantAssets) {
                expect(screen.queryByTestId(`select-${variant}`)).toBeNull();
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
