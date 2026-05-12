import { vFromSignature } from "boltz-swaps/bridge";
import { serializeTransaction } from "viem";
import { describe, expect, test } from "vitest";

import { yParityFromV } from "../../src/utils/signature";

describe("vFromSignature", () => {
    test("returns Number(v) when v is set to legacy 27", () => {
        expect(
            vFromSignature({
                r: "0x00",
                s: "0x00",
                v: 27n,
                yParity: 0,
            }),
        ).toBe(27);
    });

    test("returns Number(v) when v is set to legacy 28", () => {
        expect(
            vFromSignature({
                r: "0x00",
                s: "0x00",
                v: 28n,
                yParity: 1,
            }),
        ).toBe(28);
    });

    test("prefers v over yParity when both are present", () => {
        expect(
            vFromSignature({
                r: "0x00",
                s: "0x00",
                v: 27n,
                yParity: 1,
            }),
        ).toBe(27);
    });

    test("falls back to yParity + 27 when v is undefined (yParity 0)", () => {
        expect(
            vFromSignature({
                r: "0x00",
                s: "0x00",
                yParity: 0,
            }),
        ).toBe(27);
    });

    test("falls back to yParity + 27 when v is undefined (yParity 1)", () => {
        expect(
            vFromSignature({
                r: "0x00",
                s: "0x00",
                yParity: 1,
            }),
        ).toBe(28);
    });

    test("defaults to 27 when both v and yParity are undefined", () => {
        expect(
            vFromSignature({
                r: "0x00",
                s: "0x00",
            } as unknown as Parameters<typeof vFromSignature>[0]),
        ).toBe(27);
    });
});

describe("yParityFromV", () => {
    test("yParity-style v passes through (0 → 0, 1 → 1)", () => {
        expect(yParityFromV(0n)).toBe(0);
        expect(yParityFromV(1n)).toBe(1);
    });

    test("legacy v (27, 28) maps to yParity (0, 1)", () => {
        expect(yParityFromV(27n)).toBe(0);
        expect(yParityFromV(28n)).toBe(1);
    });

    test("EIP-155 chain-id-mixed v maps to yParity correctly", () => {
        // RSK 30: {95, 96}. BSC 56: {147, 148}. Mainnet 1: {37, 38}.
        expect(yParityFromV(95n)).toBe(0);
        expect(yParityFromV(96n)).toBe(1);
        expect(yParityFromV(147n)).toBe(0);
        expect(yParityFromV(148n)).toBe(1);
        expect(yParityFromV(37n)).toBe(0);
        expect(yParityFromV(38n)).toBe(1);
    });

    test("rejects out-of-range v values", () => {
        expect(() => yParityFromV(2n)).toThrow("unexpected signature v: 2");
        expect(() => yParityFromV(26n)).toThrow("unexpected signature v: 26");
        expect(() => yParityFromV(29n)).toThrow("unexpected signature v: 29");
        expect(() => yParityFromV(34n)).toThrow("unexpected signature v: 34");
    });
});

// viem's serializeTransaction truthy-checks yParity for EIP-1559 — any v
// (0/1, 27/28, EIP-155) must map to a correct 0/1 yParity via yParityFromV.
describe("normalizeSignature shape × serializeTransaction", () => {
    const tx = {
        chainId: 30,
        nonce: 0,
        maxPriorityFeePerGas: 1n,
        maxFeePerGas: 2n,
        gas: 21_000n,
        to: "0x2222222222222222222222222222222222222222" as const,
        value: 0n,
        data: "0x" as const,
        type: "eip1559" as const,
    };
    const r =
        "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
    const s =
        "0x2222222222222222222222222222222222222222222222222222222222222222" as const;

    test("EIP-1559 with device v=0 produces yParity byte 0x80 (RLP empty)", () => {
        const serialized = serializeTransaction(tx, {
            v: 0n,
            yParity: yParityFromV(0n),
            r,
            s,
        });
        expect(serialized).toMatch(/80a0[0-9a-f]{64}a0[0-9a-f]{64}$/);
    });

    test("EIP-1559 with device v=1 produces yParity byte 0x01", () => {
        const serialized = serializeTransaction(tx, {
            v: 1n,
            yParity: yParityFromV(1n),
            r,
            s,
        });
        expect(serialized).toMatch(/01a0[0-9a-f]{64}a0[0-9a-f]{64}$/);
    });

    test("EIP-1559 with device-returned v=27 (regression guard for hypothetical firmware) still produces yParity 0x80", () => {
        const serialized = serializeTransaction(tx, {
            v: 27n,
            yParity: yParityFromV(27n),
            r,
            s,
        });
        expect(serialized).toMatch(/80a0[0-9a-f]{64}a0[0-9a-f]{64}$/);
    });

    test("EIP-1559 with device-returned v=28 produces yParity byte 0x01", () => {
        const serialized = serializeTransaction(tx, {
            v: 28n,
            yParity: yParityFromV(28n),
            r,
            s,
        });
        expect(serialized).toMatch(/01a0[0-9a-f]{64}a0[0-9a-f]{64}$/);
    });

    test("EIP-1559 with v=0 and v=1 produce different last bytes (regression: same byte means yParity is being ignored)", () => {
        const a = serializeTransaction(tx, {
            v: 0n,
            yParity: yParityFromV(0n),
            r,
            s,
        });
        const b = serializeTransaction(tx, {
            v: 1n,
            yParity: yParityFromV(1n),
            r,
            s,
        });
        expect(a).not.toBe(b);
    });

    test("legacy EIP-155 v computation uses v directly, ignores yParity field", () => {
        const legacyTx = {
            chainId: 30,
            nonce: 0,
            gasPrice: 1_000_000_000n,
            gas: 21_000n,
            to: "0x2222222222222222222222222222222222222222" as const,
            value: 0n,
            data: "0x" as const,
            type: "legacy" as const,
        };
        // chainId 30, EIP-155: v=27 → 95 (0x5f), v=28 → 96 (0x60).
        const v27 = serializeTransaction(legacyTx, {
            v: 27n,
            yParity: yParityFromV(27n),
            r,
            s,
        });
        const v28 = serializeTransaction(legacyTx, {
            v: 28n,
            yParity: yParityFromV(28n),
            r,
            s,
        });
        expect(v27).not.toBe(v28);
        expect(v27).toMatch(/5fa0[0-9a-f]{64}a0[0-9a-f]{64}$/);
        expect(v28).toMatch(/60a0[0-9a-f]{64}a0[0-9a-f]{64}$/);
    });
});
