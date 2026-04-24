import type { ExplorerKind } from "../../components/BlockExplorer";
import type { BridgeKind } from "../../configs/base";
import { getAssetBridge } from "../../consts/Assets";
import { CctpBridgeDriver } from "./CctpBridgeDriver";
import { OftBridgeDriver } from "./OftBridgeDriver";
import type { BridgeDriver } from "./driver";
import type { BridgeRoute } from "./types";

export class BridgeRegistry {
    private readonly drivers = new Map<BridgeKind, BridgeDriver>();

    constructor(drivers: BridgeDriver[] = []) {
        for (const driver of drivers) {
            this.register(driver);
        }
    }

    private register = (driver: BridgeDriver): void => {
        this.drivers.set(driver.kind, driver);
    };

    public getDriverForAsset = (asset: string): BridgeDriver | undefined => {
        const kind = getAssetBridge(asset)?.kind;
        return kind === undefined ? undefined : this.drivers.get(kind);
    };

    public requireDriverForAsset = (asset: string): BridgeDriver => {
        const driver = this.getDriverForAsset(asset);
        if (driver === undefined) {
            throw new Error(`No bridge driver found for asset ${asset}`);
        }

        return driver;
    };

    // Assumption: both ends of a bridge route belong to the same driver kind.
    // True today because each bridge kind covers a contiguous canonical+variants
    // family. A future cross-driver bridge would need to pick source- vs
    // destination-driver explicitly.
    public requireDriverForRoute = (route: BridgeRoute): BridgeDriver => {
        return this.requireDriverForAsset(route.sourceAsset);
    };

    public getPreRoute = (asset: string): BridgeRoute | undefined => {
        return this.getDriverForAsset(asset)?.getPreRoute(asset);
    };

    public getPostRoute = (asset: string): BridgeRoute | undefined => {
        return this.getDriverForAsset(asset)?.getPostRoute(asset);
    };

    public getExplorerKind = (
        route: BridgeRoute | undefined,
    ): ExplorerKind | undefined => {
        return route === undefined
            ? undefined
            : this.requireDriverForRoute(route).getExplorerKind(route);
    };
}

export const bridgeRegistry = new BridgeRegistry([
    new OftBridgeDriver(),
    new CctpBridgeDriver(),
]);
