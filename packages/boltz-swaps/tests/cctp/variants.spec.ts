import { describe, expect, test } from "vitest";

import { cctpVariants, createCctpVariantAsset } from "../../src/cctp/index.ts";
import { evmTokenMessengerV2 } from "../../src/cctp/protocol.ts";
import { BridgeKind, NetworkTransport } from "../../src/types.ts";

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]+$/;

describe("CCTP variant catalog", () => {
    test("there is at least one variant configured", () => {
        expect(cctpVariants.length).toBeGreaterThan(0);
    });

    test.each(cctpVariants)(
        "%s declares the canonical CCTP bridge shape",
        (variant) => {
            const asset = createCctpVariantAsset(variant);
            const bridge = asset.bridge;
            expect(bridge?.kind).toBe(BridgeKind.Cctp);
            if (bridge?.kind !== BridgeKind.Cctp) {
                throw new Error(`${variant.asset} is not configured as CCTP`);
            }
            expect(bridge.canonicalAsset).toBe("USDC");

            const { domain, tokenMessenger, transferMode } = bridge.cctp;
            expect(Number.isInteger(domain)).toBe(true);
            expect(domain).toBeGreaterThanOrEqual(0);

            const isSolana =
                asset.network?.transport === NetworkTransport.Solana;
            expect(tokenMessenger).toMatch(
                isSolana ? solanaAddressPattern : addressPattern,
            );
            expect(["fast", "standard"]).toContain(transferMode);

            expect(asset.token?.address).toMatch(
                isSolana ? solanaAddressPattern : addressPattern,
            );
            expect(asset.token?.decimals).toBe(6);
            expect(variant.asset).toMatch(/^USDC-/);
        },
    );

    test("each variant has a unique domain id", () => {
        const domains = cctpVariants.map((variant) => variant.domain);
        expect(new Set(domains).size).toBe(domains.length);
    });

    test("each variant has a unique (chain, tokenAddress) tuple", () => {
        const seen = new Set<string>();
        for (const variant of cctpVariants) {
            const key = `${variant.chain}:${variant.tokenAddress.toLowerCase()}`;
            expect(
                seen.has(key),
                `duplicate deployment for ${variant.asset}`,
            ).toBe(false);
            seen.add(key);
        }
    });

    test("every EVM variant points at the shared evmTokenMessengerV2 unless it opts out", () => {
        for (const variant of cctpVariants) {
            const asset = createCctpVariantAsset(variant);
            const bridge = asset.bridge;
            if (bridge?.kind !== BridgeKind.Cctp) {
                throw new Error(`${variant.asset} is not configured as CCTP`);
            }
            if (asset.network?.transport === NetworkTransport.Evm) {
                expect(bridge.cctp.tokenMessenger).toBe(evmTokenMessengerV2);
            }
        }
    });

    test("every variant has a populated network config", () => {
        for (const variant of cctpVariants) {
            const asset = createCctpVariantAsset(variant);
            expect(
                asset.network,
                `${variant.asset} missing network`,
            ).toBeDefined();
            if (asset.network!.transport === NetworkTransport.Evm) {
                expect(asset.network!.chainId).toBeGreaterThan(0);
            }
            expect(asset.network!.rpcUrls.length).toBeGreaterThan(0);
            expect(asset.network!.chainName.length).toBeGreaterThan(0);
        }
    });
});
