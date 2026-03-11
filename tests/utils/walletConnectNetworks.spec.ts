import log from "loglevel";

import { Explorer } from "../../src/configs/base";
import { AssetKind, RBTC, TBTC, USDT0 } from "../../src/consts/Assets";
import { buildWalletConnectNetworks } from "../../src/utils/walletConnectNetworks";

const makeNetwork = (chainId: number, chainName: string, symbol: string) => ({
    chainId,
    chainName,
    symbol,
    gasToken: symbol,
    rpcUrls: [`https://${chainName.toLowerCase()}.example`],
    nativeCurrency: {
        name: symbol,
        symbol,
        decimals: 18,
    },
});

const validRbtcConfig = {
    type: AssetKind.EVMNative,
    network: makeNetwork(30, "Rootstock", "RBTC"),
    blockExplorerUrl: {
        id: Explorer.Blockscout,
        normal: "https://rootstock.example",
    },
};

describe("walletConnectNetworks", () => {
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});

    afterEach(() => warnSpy.mockClear());

    test("builds networks from supported assets and dedupes by chain id", () => {
        const assetsConfig = {
            [RBTC]: validRbtcConfig,
            [TBTC]: {
                type: AssetKind.EVMNative,
                network: makeNetwork(42161, "Arbitrum", "ETH"),
                blockExplorerUrl: {
                    id: Explorer.Blockscout,
                    normal: "https://arb-tbtc.example",
                },
            },
            [USDT0]: {
                type: AssetKind.ERC20,
                network: makeNetwork(42161, "Arbitrum", "ETH"),
                blockExplorerUrl: {
                    id: Explorer.Blockscout,
                    normal: "https://arb-usdt0.example",
                },
            },
        };

        const networks = buildWalletConnectNetworks(assetsConfig, [
            RBTC,
            TBTC,
            USDT0,
        ]);

        expect(networks).toHaveLength(2);
        expect(networks[0].id).toBe(30);
        expect(networks[1].id).toBe(42161);
        expect(networks[1].blockExplorers!.default.url).toBe(
            "https://arb-tbtc.example",
        );
    });

    test("skips assets with missing config and builds remaining", () => {
        const assetsConfig = {
            [RBTC]: validRbtcConfig,
        };

        const networks = buildWalletConnectNetworks(assetsConfig, [RBTC, TBTC]);

        expect(networks).toHaveLength(1);
        expect(networks[0].id).toBe(30);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("skipping TBTC"),
        );
    });

    test("skips assets with missing network config", () => {
        const assetsConfig = {
            [RBTC]: validRbtcConfig,
            [TBTC]: {
                type: AssetKind.EVMNative,
                blockExplorerUrl: {
                    id: Explorer.Blockscout,
                    normal: "https://arb.example",
                },
            },
        };

        const networks = buildWalletConnectNetworks(assetsConfig, [RBTC, TBTC]);

        expect(networks).toHaveLength(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("skipping TBTC - missing network config"),
        );
    });

    test("skips assets with empty rpc urls", () => {
        const assetsConfig = {
            [RBTC]: validRbtcConfig,
            [TBTC]: {
                type: AssetKind.EVMNative,
                network: {
                    ...makeNetwork(42161, "Arbitrum", "ETH"),
                    rpcUrls: [],
                },
                blockExplorerUrl: {
                    id: Explorer.Blockscout,
                    normal: "https://arb.example",
                },
            },
        };

        const networks = buildWalletConnectNetworks(assetsConfig, [RBTC, TBTC]);

        expect(networks).toHaveLength(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("skipping TBTC - missing rpc urls"),
        );
    });

    test("skips assets with missing block explorer url", () => {
        const assetsConfig = {
            [RBTC]: validRbtcConfig,
            [TBTC]: {
                type: AssetKind.EVMNative,
                network: makeNetwork(42161, "Arbitrum", "ETH"),
            },
        };

        const networks = buildWalletConnectNetworks(assetsConfig, [RBTC, TBTC]);

        expect(networks).toHaveLength(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                "skipping TBTC - missing block explorer url",
            ),
        );
    });

    test("throws when no supported networks remain after validation", () => {
        expect(() =>
            buildWalletConnectNetworks(
                { [RBTC]: { type: AssetKind.EVMNative } },
                [RBTC],
            ),
        ).toThrow(/no supported networks configured/);
    });
});
