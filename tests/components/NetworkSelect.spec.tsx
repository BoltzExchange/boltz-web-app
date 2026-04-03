import { fireEvent, render, screen } from "@solidjs/testing-library";

import NetworkSelect from "../../src/components/NetworkSelect";
import type * as ConfigModule from "../../src/config";
import { config } from "../../src/config";
import { BTC, LN, RBTC } from "../../src/consts/Assets";
import { AssetSelection, Side } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import { TestComponent, contextWrapper, signals } from "../helper";
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

const usdt0VariantAssets = getUsdt0Variants(config.assets);
const sendableUsdt0VariantAssets = getSendableUsdt0VariantAssets(config.assets);
const unsendableUsdt0VariantAssets = getUnsendableUsdt0VariantAssets(
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

    signals.setAssetSelection(AssetSelection.AssetNetwork);
    signals.setAssetSelected(side);
};

describe("NetworkSelect", () => {
    test("should hide unsendable networks when selecting send asset", async () => {
        openNetworkSelect();

        await screen.findByText(i18n.en.select_network);

        for (const variant of sendableUsdt0VariantAssets) {
            expect(screen.queryByTestId(`select-${variant}`)).not.toBeNull();
        }

        for (const variant of unsendableUsdt0VariantAssets) {
            expect(screen.queryByTestId(`select-${variant}`)).toBeNull();
        }
    });

    test("should still show unsendable networks when selecting receive asset", async () => {
        openNetworkSelect(Side.Receive);

        await screen.findByText(i18n.en.select_network);

        for (const variant of usdt0VariantAssets) {
            expect(screen.queryByTestId(`select-${variant}`)).not.toBeNull();
        }
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
