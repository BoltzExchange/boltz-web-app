import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import NetworkSelect from "../../src/components/NetworkSelect";
import type * as ConfigModule from "../../src/config";
import { config } from "../../src/config";
import { BTC, LN, RBTC, USDT0 } from "../../src/consts/Assets";
import { AssetSelection, Side } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import { TestComponent, contextWrapper, signals } from "../helper";
import { pairs } from "../pairs";
import {
    getBridgeVariantAssets,
    getSendableBridgeVariantAssets,
    getUnsendableBridgeVariantAssets,
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
                "USDT0-DIS": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
                    disabled: true,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Disabled Chain",
                        symbol: "DIS",
                        gasToken: "DIS",
                        chainId: 9999,
                        nativeCurrency: {
                            name: "DIS",
                            symbol: "DIS",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000009999",
                    },
                },
            },
        },
    };
});

const bridgeVariantAssets = getBridgeVariantAssets(config.assets);
const sendableBridgeVariantAssets = getSendableBridgeVariantAssets(
    config.assets,
);
const unsendableBridgeVariantAssets = getUnsendableBridgeVariantAssets(
    config.assets,
);
const evmAddress = "0x5000000000000000000000000000000000000000";

const openNetworkSelect = (side = Side.Send) => {
    render(
        () => (
            <>
                <TestComponent />
                <NetworkSelect />
            </>
        ),
        { wrapper: contextWrapper },
    );

    signals.setNetworkSelectCanonical(USDT0);
    signals.setAssetSelection(AssetSelection.AssetNetwork);
    signals.setAssetSelected(side);
};

describe("NetworkSelect", () => {
    test("should hide unsendable networks when selecting send asset", async () => {
        openNetworkSelect();

        await screen.findByText(i18n.en.select_network);

        for (const variant of sendableBridgeVariantAssets) {
            expect(screen.queryByTestId(`select-${variant}`)).not.toBeNull();
        }

        for (const variant of unsendableBridgeVariantAssets) {
            expect(screen.queryByTestId(`select-${variant}`)).toBeNull();
        }
    });

    test("should still show unsendable networks when selecting receive asset", async () => {
        openNetworkSelect(Side.Receive);

        await screen.findByText(i18n.en.select_network);

        for (const variant of bridgeVariantAssets) {
            expect(screen.queryByTestId(`select-${variant}`)).not.toBeNull();
        }
    });

    test("should mark disabled networks as disabled and ignore clicks", async () => {
        openNetworkSelect();
        setPairAssets("USDT0-ETH", BTC);

        const entry = (await screen.findByTestId(
            "select-USDT0-DIS",
        )) as HTMLButtonElement;

        expect(entry.disabled).toBe(true);
        expect(entry.getAttribute("data-disabled")).toEqual("true");

        const setPair = vi.spyOn(signals, "setPair");

        fireEvent.click(entry);

        expect(setPair).not.toHaveBeenCalled();
        expect(signals.pair().fromAsset).toEqual("USDT0-ETH");
        expect(signals.assetSelection()).toEqual(AssetSelection.AssetNetwork);
    });

    test("should focus the next enabled network when the selected network is disabled", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <NetworkSelect />
                </>
            ),
            { wrapper: contextWrapper },
        );

        setPairAssets("USDT0-DIS", BTC);
        signals.setAssetSelected(Side.Send);
        signals.setAssetSelection(AssetSelection.AssetNetwork);

        await screen.findByTestId("select-USDT0-ETH");

        await waitFor(() => {
            expect(
                screen
                    .getByTestId("select-USDT0-ETH")
                    .getAttribute("data-focused"),
            ).toEqual("true");
        });
        expect(
            screen.getByTestId("select-USDT0-DIS").getAttribute("data-focused"),
        ).not.toEqual("true");
    });

    test("should skip disabled networks during keyboard navigation", async () => {
        openNetworkSelect();

        await screen.findByTestId(`select-${USDT0}`);

        await waitFor(() => {
            expect(
                screen
                    .getByTestId(`select-${USDT0}`)
                    .getAttribute("data-focused"),
            ).toEqual("true");
        });

        const modal = document.querySelector(".asset-select-modal");
        expect(modal).not.toBeNull();

        fireEvent.keyDown(modal as HTMLDivElement, { key: "ArrowDown" });

        await waitFor(() => {
            expect(
                screen
                    .getByTestId("select-USDT0-ETH")
                    .getAttribute("data-focused"),
            ).toEqual("true");
        });
        expect(
            screen.getByTestId("select-USDT0-DIS").getAttribute("data-focused"),
        ).not.toEqual("true");
    });

    test("should change the send asset when selecting a network", async () => {
        openNetworkSelect();
        setPairAssets("USDT0-ETH", BTC);

        fireEvent.click(await screen.findByTestId("select-USDT0-OP"));

        expect(signals.pair().fromAsset).toEqual("USDT0-OP");
        expect(screen.queryByText(i18n.en.select_network)).toBeNull();
    });

    test("should not clear EVM-style destination when only send network changes", async () => {
        openNetworkSelect();
        setPairAssets("USDT0-ETH", RBTC);
        signals.setOnchainAddress(evmAddress);
        signals.setAddressValid(true);

        fireEvent.click(await screen.findByTestId("select-USDT0-POL"));

        expect(signals.pair().fromAsset).toEqual("USDT0-POL");
        expect(signals.pair().toAsset).toEqual(RBTC);
        expect(signals.onchainAddress()).toEqual(evmAddress);
    });

    test("should not clear EVM-style destination when receive network changes", async () => {
        openNetworkSelect(Side.Receive);
        setPairAssets(LN, "USDT0-ETH");
        signals.setOnchainAddress(evmAddress);
        signals.setAddressValid(true);

        fireEvent.click(await screen.findByTestId("select-USDT0-POL"));

        expect(signals.pair().toAsset).toEqual("USDT0-POL");
        expect(signals.onchainAddress()).toEqual(evmAddress);
    });
});
