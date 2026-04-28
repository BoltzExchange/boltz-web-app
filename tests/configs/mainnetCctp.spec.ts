// @vitest-environment node
import { config as runtimeConfig } from "../../src/config";
import { BridgeKind, CctpTransferMode } from "../../src/configs/base";
import { config } from "../../src/configs/mainnet";
import { CctpBridgeDriver } from "../../src/utils/bridge/CctpBridgeDriver";
import { clearCache } from "../../src/utils/cache";
import { getCctpFee } from "../../src/utils/cctp/fee";

const originalAssets = structuredClone(runtimeConfig.assets ?? {});
const originalFeeApiUrl = runtimeConfig.cctpApiUrl;

beforeAll(() => {
    runtimeConfig.assets = structuredClone(config.assets);
    runtimeConfig.cctpApiUrl = config.cctpApiUrl;
});

afterEach(() => {
    clearCache();
});

afterAll(() => {
    runtimeConfig.assets = originalAssets;
    runtimeConfig.cctpApiUrl = originalFeeApiUrl;
});

type CctpRouteTestCase = {
    sourceAsset: string;
    destinationAsset: string;
    sourceDomainId: number;
    destDomainId: number;
};

const cctpRouteTestCases: CctpRouteTestCase[] = Object.entries(
    config.assets,
).flatMap(([asset, assetConfig]) => {
    const bridge = assetConfig.bridge;
    if (
        bridge?.kind !== BridgeKind.Cctp ||
        bridge.canonicalAsset === asset ||
        config.assets[bridge.canonicalAsset]?.bridge?.kind !== BridgeKind.Cctp
    ) {
        return [];
    }

    const canonicalAssetConfig = config.assets[bridge.canonicalAsset];
    const canonicalBridge = canonicalAssetConfig?.bridge;
    if (canonicalBridge?.kind !== BridgeKind.Cctp) {
        return [];
    }

    return [
        {
            sourceAsset: bridge.canonicalAsset,
            destinationAsset: asset,
            sourceDomainId: canonicalBridge.cctp.domain,
            destDomainId: bridge.cctp.domain,
        },
        {
            sourceAsset: asset,
            destinationAsset: bridge.canonicalAsset,
            sourceDomainId: bridge.cctp.domain,
            destDomainId: canonicalBridge.cctp.domain,
        },
    ];
});

test.each(cctpRouteTestCases)(
    "$sourceAsset -> $destinationAsset should resolve live Iris fees with forwarding",
    async ({ sourceDomainId, destDomainId }: CctpRouteTestCase) => {
        const [fastFee, standardFee] = await Promise.all([
            getCctpFee(sourceDomainId, destDomainId, CctpTransferMode.Fast),
            getCctpFee(sourceDomainId, destDomainId, CctpTransferMode.Standard),
        ]);

        expect(fastFee.bpsUnits).toBeGreaterThanOrEqual(0n);
        expect(standardFee.bpsUnits).toBeGreaterThanOrEqual(0n);
        expect(fastFee.forwardFee).toBeGreaterThan(0n);
        expect(standardFee.forwardFee).toBeGreaterThan(0n);
    },
    60_000,
);

test.each(cctpRouteTestCases)(
    "$sourceAsset -> $destinationAsset should quote against the live Iris API",
    async ({ sourceAsset, destinationAsset }: CctpRouteTestCase) => {
        const driver = new CctpBridgeDriver();
        const route = {
            sourceAsset,
            destinationAsset,
        };

        const [fastQuote, standardQuote, requiredAmount] = await Promise.all([
            driver.quoteReceiveAmount(route, 1_000_000n, {
                cctpTransferMode: CctpTransferMode.Fast,
            }),
            driver.quoteReceiveAmount(route, 1_000_000n, {
                cctpTransferMode: CctpTransferMode.Standard,
            }),
            driver.quoteAmountInForAmountOut(route, 1_000_000n, {
                cctpTransferMode: CctpTransferMode.Fast,
            }),
        ]);

        expect(fastQuote.amountIn).toBe(1_000_000n);
        expect(fastQuote.amountOut).toBeLessThanOrEqual(fastQuote.amountIn);
        expect(standardQuote.amountOut).toBeGreaterThanOrEqual(
            fastQuote.amountOut,
        );
        expect(requiredAmount).toBeGreaterThanOrEqual(1_000_000n);
    },
    60_000,
);
