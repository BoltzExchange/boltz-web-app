import type * as ConfigModule from "../../../src/config";
import { BridgeKind } from "../../../src/configs/base";
import { BridgeRegistry } from "../../../src/utils/bridge";
import { TestBridgeDriver } from "./testDriver";

// Stub runtime config so `getAssetBridge` (which the registry delegates to)
// returns the expected bridge kind for each test asset.
vi.mock("../../../src/config", async () => {
    const actual = await vi.importActual<typeof ConfigModule>(
        "../../../src/config",
    );
    return {
        ...actual,
        config: {
            ...actual.config,
            assets: {
                HUB: {
                    type: "erc20",
                    bridge: {
                        kind: BridgeKind.Oft,
                        canonicalAsset: "HUB",
                    },
                },
                "HUB-A": {
                    type: "erc20",
                    bridge: {
                        kind: BridgeKind.Oft,
                        canonicalAsset: "HUB",
                    },
                },
                "HUB-B": {
                    type: "erc20",
                    bridge: {
                        kind: BridgeKind.Oft,
                        canonicalAsset: "HUB",
                    },
                },
                BTC: {
                    type: "utxo",
                },
            },
        },
    };
});

describe("BridgeRegistry", () => {
    const driver = new TestBridgeDriver(BridgeKind.Oft);
    const registry = new BridgeRegistry([driver]);

    describe("getDriverForAsset", () => {
        test("returns the registered driver for a bridge-kinded asset", () => {
            expect(registry.getDriverForAsset("HUB-A")).toBe(driver);
            expect(registry.getDriverForAsset("HUB")).toBe(driver);
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
            expect(registry.requireDriverForAsset("HUB-A")).toBe(driver);
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
                    sourceAsset: "HUB-A",
                    destinationAsset: "HUB",
                }),
            ).toBe(driver);
        });

        test("throws when the source asset has no driver", () => {
            expect(() =>
                registry.requireDriverForRoute({
                    sourceAsset: "BTC",
                    destinationAsset: "HUB",
                }),
            ).toThrow();
        });
    });

    describe("getPreRoute / getPostRoute", () => {
        test("getPreRoute delegates to the driver and returns a variant → canonical route", () => {
            expect(registry.getPreRoute("HUB-A")).toEqual({
                sourceAsset: "HUB-A",
                destinationAsset: "HUB",
            });
        });

        test("getPostRoute delegates to the driver and returns a canonical → variant route", () => {
            expect(registry.getPostRoute("HUB-A")).toEqual({
                sourceAsset: "HUB",
                destinationAsset: "HUB-A",
            });
        });

        test("getPreRoute and getPostRoute return undefined for the canonical asset itself", () => {
            expect(registry.getPreRoute("HUB")).toBeUndefined();
            expect(registry.getPostRoute("HUB")).toBeUndefined();
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
                    sourceAsset: "HUB-A",
                    destinationAsset: "HUB",
                }),
            ).toBe("layerZero");
        });
    });

    describe("constructor registration", () => {
        test("registers each driver by its kind", () => {
            const empty = new BridgeRegistry();
            expect(empty.getDriverForAsset("HUB-A")).toBeUndefined();

            const populated = new BridgeRegistry([driver]);
            expect(populated.getDriverForAsset("HUB-A")).toBe(driver);
        });

        test("a later-registered driver with the same kind replaces the earlier one", () => {
            const first = new TestBridgeDriver(BridgeKind.Oft);
            const second = new TestBridgeDriver(BridgeKind.Oft);
            const reg = new BridgeRegistry([first, second]);
            expect(reg.getDriverForAsset("HUB-A")).toBe(second);
        });
    });
});
