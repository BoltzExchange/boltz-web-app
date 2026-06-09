import { hex } from "@scure/base";
import { Buffer } from "buffer";
import { describe, expect, test } from "vitest";

import { BTC, LBTC } from "../../src/consts/Assets";
import {
    formatBlindingData,
    getClaimBlindingData,
} from "../../src/utils/blindedExplorer";
import type { LiquidTransactionOutputWithKey } from "../../src/utils/compat";

const reverse = (b: Uint8Array) => Uint8Array.from(b).reverse();

describe("blindedExplorer", () => {
    test("formatBlindingData reverses asset and blinders", () => {
        const asset = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i));
        const vbf = Uint8Array.from(
            Array.from({ length: 32 }, (_, i) => i + 32),
        );
        const abf = Uint8Array.from(
            Array.from({ length: 32 }, (_, i) => i + 64),
        );

        expect(
            formatBlindingData({
                value: "12345",
                asset,
                valueBlindingFactor: vbf,
                assetBlindingFactor: abf,
            }),
        ).toEqual(
            [
                "12345",
                hex.encode(reverse(asset)),
                hex.encode(reverse(vbf)),
                hex.encode(reverse(abf)),
            ].join(","),
        );
    });

    // Fixture using the canonical Liquid L-BTC asset id: liquidjs hands us the
    // asset in internal byte order, so feeding that in must produce the display
    // id (networks.liquid.assetHash) back. Pins bytes, field order and
    // separators against an externally known value.
    test("formatBlindingData emits the canonical explorer fragment", () => {
        const assetDisplay =
            "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d";
        const vbfDisplay =
            "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
        const abfDisplay =
            "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";

        expect(
            formatBlindingData({
                value: "100000000",
                asset: reverse(hex.decode(assetDisplay)),
                valueBlindingFactor: reverse(hex.decode(vbfDisplay)),
                assetBlindingFactor: reverse(hex.decode(abfDisplay)),
            }),
        ).toEqual(`100000000,${assetDisplay},${vbfDisplay},${abfDisplay}`);
    });

    const output = {
        rangeProof: Buffer.alloc(64, 1),
        blindingPrivateKey: Buffer.alloc(32, 2),
    } as unknown as LiquidTransactionOutputWithKey;

    test("getClaimBlindingData returns undefined for non-Liquid assets", async () => {
        await expect(
            getClaimBlindingData(BTC, output),
        ).resolves.toBeUndefined();
    });

    test("getClaimBlindingData returns undefined without a blinding key", async () => {
        await expect(
            getClaimBlindingData(LBTC, {
                ...output,
                blindingPrivateKey: undefined,
            } as LiquidTransactionOutputWithKey),
        ).resolves.toBeUndefined();
    });

    test("getClaimBlindingData returns undefined without a rangeproof", async () => {
        await expect(
            getClaimBlindingData(LBTC, {
                ...output,
                rangeProof: Buffer.alloc(0),
            } as unknown as LiquidTransactionOutputWithKey),
        ).resolves.toBeUndefined();
    });
});
