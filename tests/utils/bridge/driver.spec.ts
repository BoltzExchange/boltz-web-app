import type * as ConfigModule from "../../../src/config";
import { BridgeKind } from "../../../src/configs/base";
import { SwapPosition } from "../../../src/consts/Enums";
import { TestBridgeDriver } from "./testDriver";

// Populate a small runtime-config fixture. `getAssetBridge` reads from here.
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
                "HUB-NO-CANONICAL-CONFIG": {
                    // Variant that points at a canonical that is not in config.
                    type: "erc20",
                    bridge: {
                        kind: BridgeKind.Oft,
                        canonicalAsset: "DOES-NOT-EXIST",
                    },
                },
                "ALIEN-KIND": {
                    type: "erc20",
                    bridge: {
                        // Cast to simulate an asset belonging to a future
                        // bridge kind that this driver doesn't serve.
                        kind: "alien" as BridgeKind,
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

describe("BridgeDriver (base class)", () => {
    const driver = new TestBridgeDriver(BridgeKind.Oft);

    describe("supportsAsset", () => {
        test("returns true when the asset's bridge.kind matches this driver", () => {
            expect(driver.supportsAsset("HUB")).toBe(true);
            expect(driver.supportsAsset("HUB-A")).toBe(true);
        });

        test("returns false for an asset belonging to a different bridge kind", () => {
            expect(driver.supportsAsset("ALIEN-KIND")).toBe(false);
        });

        test("returns false for a non-bridged asset", () => {
            expect(driver.supportsAsset("BTC")).toBe(false);
            expect(driver.supportsAsset("UNKNOWN")).toBe(false);
        });
    });

    describe("getRoutePosition", () => {
        test("stamps this driver's kind and the given position onto the route", () => {
            const detail = driver.getRoutePosition(
                { sourceAsset: "HUB-A", destinationAsset: "HUB" },
                SwapPosition.Pre,
            );
            expect(detail).toEqual({
                sourceAsset: "HUB-A",
                destinationAsset: "HUB",
                kind: BridgeKind.Oft,
                position: SwapPosition.Pre,
            });
        });

        test("accepts Post position", () => {
            const detail = driver.getRoutePosition(
                { sourceAsset: "HUB", destinationAsset: "HUB-A" },
                SwapPosition.Post,
            );
            expect(detail.position).toBe(SwapPosition.Post);
        });
    });

    describe("getPreRoute", () => {
        test("returns a variant → canonical route for a variant asset", () => {
            expect(driver.getPreRoute("HUB-A")).toEqual({
                sourceAsset: "HUB-A",
                destinationAsset: "HUB",
            });
        });

        test("returns undefined for the canonical asset itself", () => {
            expect(driver.getPreRoute("HUB")).toBeUndefined();
        });

        test("returns undefined for an asset with an alien bridge kind", () => {
            expect(driver.getPreRoute("ALIEN-KIND")).toBeUndefined();
        });

        test("returns undefined for a non-bridged asset", () => {
            expect(driver.getPreRoute("BTC")).toBeUndefined();
            expect(driver.getPreRoute("UNKNOWN")).toBeUndefined();
        });

        test("returns undefined when the canonical asset is missing from config", () => {
            expect(
                driver.getPreRoute("HUB-NO-CANONICAL-CONFIG"),
            ).toBeUndefined();
        });
    });

    describe("getPostRoute", () => {
        test("returns a canonical → variant route for a variant asset", () => {
            expect(driver.getPostRoute("HUB-A")).toEqual({
                sourceAsset: "HUB",
                destinationAsset: "HUB-A",
            });
        });

        test("returns undefined for the canonical asset itself", () => {
            expect(driver.getPostRoute("HUB")).toBeUndefined();
        });

        test("returns undefined for a non-bridged asset", () => {
            expect(driver.getPostRoute("BTC")).toBeUndefined();
        });

        test("returns undefined for an asset belonging to another bridge kind", () => {
            expect(driver.getPostRoute("ALIEN-KIND")).toBeUndefined();
        });
    });

    describe("getNativeDropFailure (default)", () => {
        test("returns undefined — drivers opt in by overriding", () => {
            expect(
                driver.getNativeDropFailure({ message: "anything" }),
            ).toBeUndefined();
        });
    });
});
