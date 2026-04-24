import { BridgeKind } from "../../src/configs/base";
import { cctpVariantAssets, tokenMessengerV2 } from "../../src/configs/cctp";

const addressPattern = /^0x[0-9a-fA-F]{40}$/;

describe("CCTP variant assets", () => {
    const entries = Object.entries(cctpVariantAssets);

    test("there is at least one variant configured", () => {
        expect(entries.length).toBeGreaterThan(0);
    });

    test.each(entries)(
        "%s declares the canonical CCTP bridge shape",
        (asset, config) => {
            expect(config.bridge).toBeDefined();
            expect(config.bridge!.kind).toBe(BridgeKind.Cctp);
            expect(config.bridge!.canonicalAsset).toBe("USDC");
            expect(config.bridge!.cctp).toBeDefined();

            const { domain, tokenMessenger, transferMode } =
                config.bridge!.cctp!;
            expect(Number.isInteger(domain)).toBe(true);
            expect(domain).toBeGreaterThanOrEqual(0);
            expect(tokenMessenger).toMatch(addressPattern);
            // `CctpTransferMode` is a const enum; compare against its literal values.
            expect(["fast", "standard"]).toContain(transferMode);

            expect(config.token?.address).toMatch(addressPattern);
            expect(config.token?.decimals).toBe(6);
            expect(asset).toMatch(/^USDC-/);
        },
    );

    test("each variant has a unique domain id", () => {
        const domains = entries.map(
            ([, config]) => config.bridge!.cctp!.domain,
        );
        expect(new Set(domains).size).toBe(domains.length);
    });

    test("each variant has a unique (chainId, tokenAddress) tuple", () => {
        const seen = new Set<string>();
        for (const [asset, config] of entries) {
            const key = `${config.network!.chainId}:${config.token!.address.toLowerCase()}`;
            expect(seen.has(key), `duplicate deployment for ${asset}`).toBe(
                false,
            );
            seen.add(key);
        }
    });

    test("every variant points at the shared TokenMessengerV2 unless it opts out", () => {
        // Currently no chain overrides the default; EDGE (domain 28) would be
        // the expected exception when added. Tightening this test ensures we
        // don't accidentally introduce a typo'd address.
        for (const [, config] of entries) {
            expect(config.bridge!.cctp!.tokenMessenger).toBe(tokenMessengerV2);
        }
    });

    test("every variant has a populated EVM network config", () => {
        for (const [asset, config] of entries) {
            expect(config.network, `${asset} missing network`).toBeDefined();
            expect(config.network!.chainId).toBeGreaterThan(0);
            expect(config.network!.rpcUrls.length).toBeGreaterThan(0);
            expect(config.network!.chainName.length).toBeGreaterThan(0);
        }
    });
});
