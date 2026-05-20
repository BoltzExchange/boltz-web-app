import { BridgeRegistry } from "boltz-swaps/bridge";
import { setBoltzSwapsConfig } from "boltz-swaps/config";
import { BridgeKind } from "boltz-swaps/types";

import { TestBridgeDriver } from "./testDriver.ts";

beforeAll(() => {
    setBoltzSwapsConfig({
        assets: {
            USDT0: {
                type: "erc20",
                bridge: {
                    kind: BridgeKind.Oft,
                    canonicalAsset: "USDT0",
                },
            },
            "USDT0-ETH": {
                type: "erc20",
                bridge: {
                    kind: BridgeKind.Oft,
                    canonicalAsset: "USDT0",
                },
            },
            "USDT0-POL": {
                type: "erc20",
                bridge: {
                    kind: BridgeKind.Oft,
                    canonicalAsset: "USDT0",
                },
            },
            BTC: {
                type: "utxo",
            },
        } as never,
    });
});

describe("BridgeRegistry", () => {
    const driver = new TestBridgeDriver(BridgeKind.Oft);
    const registry = new BridgeRegistry([driver]);

    describe("getDriverForAsset", () => {
        test("returns the registered driver for a bridge-kinded asset", () => {
            expect(registry.getDriverForAsset("USDT0-ETH")).toBe(driver);
            expect(registry.getDriverForAsset("USDT0")).toBe(driver);
        });

        test("returns undefined for an asset without a bridge", () => {
            expect(registry.getDriverForAsset("BTC")).toBeUndefined();
        });

        test("returns undefined for an unknown asset", () => {
            expect(
                registry.getDriverForAsset("DOES-NOT-EXIST"),
            ).toBeUndefined();
        });
    });

    describe("requireDriverForAsset", () => {
        test("returns the driver when one is registered", () => {
            expect(registry.requireDriverForAsset("USDT0-ETH")).toBe(driver);
        });

        test("throws for an asset with no registered driver", () => {
            expect(() => registry.requireDriverForAsset("BTC")).toThrow(
                /No bridge driver found for asset BTC/,
            );
        });
    });

    describe("requireDriverForRoute", () => {
        test("looks up by sourceAsset", () => {
            expect(
                registry.requireDriverForRoute({
                    sourceAsset: "USDT0-ETH",
                    destinationAsset: "USDT0",
                }),
            ).toBe(driver);
        });

        test("throws when the source asset has no driver", () => {
            expect(() =>
                registry.requireDriverForRoute({
                    sourceAsset: "BTC",
                    destinationAsset: "USDT0",
                }),
            ).toThrow();
        });
    });

    describe("getPreRoute / getPostRoute", () => {
        test("getPreRoute delegates to the driver and returns a variant → canonical route", () => {
            expect(registry.getPreRoute("USDT0-ETH")).toEqual({
                sourceAsset: "USDT0-ETH",
                destinationAsset: "USDT0",
            });
        });

        test("getPostRoute delegates to the driver and returns a canonical → variant route", () => {
            expect(registry.getPostRoute("USDT0-ETH")).toEqual({
                sourceAsset: "USDT0",
                destinationAsset: "USDT0-ETH",
            });
        });

        test("getPreRoute and getPostRoute return undefined for the canonical asset itself", () => {
            expect(registry.getPreRoute("USDT0")).toBeUndefined();
            expect(registry.getPostRoute("USDT0")).toBeUndefined();
        });

        test("return undefined for assets without a bridge", () => {
            expect(registry.getPreRoute("BTC")).toBeUndefined();
            expect(registry.getPostRoute("BTC")).toBeUndefined();
        });
    });

    describe("getExplorerKind", () => {
        test("returns undefined when the route is undefined", () => {
            expect(registry.getExplorerKind(undefined)).toBeUndefined();
        });

        test("delegates to the driver's getExplorerKind when the route is defined", () => {
            const explorerDriver = new TestBridgeDriver(BridgeKind.Oft);
            // Override only the one method we care about here.
            explorerDriver.getExplorerKind = () => "layerZero" as never;
            const explorerRegistry = new BridgeRegistry([explorerDriver]);

            expect(
                explorerRegistry.getExplorerKind({
                    sourceAsset: "USDT0-ETH",
                    destinationAsset: "USDT0",
                }),
            ).toBe("layerZero");
        });
    });

    describe("constructor registration", () => {
        test("registers each driver by its kind", () => {
            const empty = new BridgeRegistry();
            expect(empty.getDriverForAsset("USDT0-ETH")).toBeUndefined();

            const populated = new BridgeRegistry([driver]);
            expect(populated.getDriverForAsset("USDT0-ETH")).toBe(driver);
        });

        test("a later-registered driver with the same kind replaces the earlier one", () => {
            const first = new TestBridgeDriver(BridgeKind.Oft);
            const second = new TestBridgeDriver(BridgeKind.Oft);
            const reg = new BridgeRegistry([first, second]);
            expect(reg.getDriverForAsset("USDT0-ETH")).toBe(second);
        });
    });
});
