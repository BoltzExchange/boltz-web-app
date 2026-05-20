import { setBoltzSwapsConfig } from "boltz-swaps/config";
import { BridgeKind, SwapPosition } from "boltz-swaps/types";

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
            // Edge case: an OFT variant whose canonical isn't mapped in the
            // registry. Naming it "-UNMAPPED" signals the intentional gap.
            "USDT0-UNMAPPED": {
                type: "erc20",
                bridge: {
                    kind: BridgeKind.Oft,
                    canonicalAsset: "USDT0-MISSING",
                },
            },
            // USDC uses the CCTP bridge — the driver under test is OFT, so
            // this exercises the "different bridge kind" path.
            USDC: {
                type: "erc20",
                bridge: {
                    kind: BridgeKind.Cctp,
                    canonicalAsset: "USDC",
                },
            },
            BTC: {
                type: "utxo",
            },
        } as never,
    });
});

describe("BridgeDriver (base class)", () => {
    const driver = new TestBridgeDriver(BridgeKind.Oft);

    describe("supportsAsset", () => {
        test("returns true when the asset's bridge.kind matches this driver", () => {
            expect(driver.supportsAsset("USDT0")).toBe(true);
            expect(driver.supportsAsset("USDT0-ETH")).toBe(true);
        });

        test("returns false for an asset belonging to a different bridge kind", () => {
            expect(driver.supportsAsset("USDC")).toBe(false);
        });

        test("returns false for a non-bridged asset", () => {
            expect(driver.supportsAsset("BTC")).toBe(false);
            expect(driver.supportsAsset("UNKNOWN")).toBe(false);
        });
    });

    describe("getRoutePosition", () => {
        test("stamps this driver's kind and the given position onto the route", () => {
            const detail = driver.getRoutePosition(
                { sourceAsset: "USDT0-ETH", destinationAsset: "USDT0" },
                SwapPosition.Pre,
            );
            expect(detail).toEqual({
                sourceAsset: "USDT0-ETH",
                destinationAsset: "USDT0",
                kind: BridgeKind.Oft,
                position: SwapPosition.Pre,
            });
        });

        test("accepts Post position", () => {
            const detail = driver.getRoutePosition(
                { sourceAsset: "USDT0", destinationAsset: "USDT0-ETH" },
                SwapPosition.Post,
            );
            expect(detail.position).toBe(SwapPosition.Post);
        });
    });

    describe("getPreRoute", () => {
        test("returns a variant → canonical route for a variant asset", () => {
            expect(driver.getPreRoute("USDT0-ETH")).toEqual({
                sourceAsset: "USDT0-ETH",
                destinationAsset: "USDT0",
            });
        });

        test("returns undefined for the canonical asset itself", () => {
            expect(driver.getPreRoute("USDT0")).toBeUndefined();
        });

        test("returns undefined for an asset with a different bridge kind", () => {
            expect(driver.getPreRoute("USDC")).toBeUndefined();
        });

        test("returns undefined for a non-bridged asset", () => {
            expect(driver.getPreRoute("BTC")).toBeUndefined();
            expect(driver.getPreRoute("UNKNOWN")).toBeUndefined();
        });

        test("returns undefined when the canonical asset is missing from config", () => {
            expect(driver.getPreRoute("USDT0-UNMAPPED")).toBeUndefined();
        });
    });

    describe("getPostRoute", () => {
        test("returns a canonical → variant route for a variant asset", () => {
            expect(driver.getPostRoute("USDT0-ETH")).toEqual({
                sourceAsset: "USDT0",
                destinationAsset: "USDT0-ETH",
            });
        });

        test("returns undefined for the canonical asset itself", () => {
            expect(driver.getPostRoute("USDT0")).toBeUndefined();
        });

        test("returns undefined for a non-bridged asset", () => {
            expect(driver.getPostRoute("BTC")).toBeUndefined();
        });

        test("returns undefined for an asset belonging to another bridge kind", () => {
            expect(driver.getPostRoute("USDC")).toBeUndefined();
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
