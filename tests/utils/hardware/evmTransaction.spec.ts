import { describe, expect, test } from "vitest";

import {
    type HardwareFeeData,
    type HardwareTransactionLike,
    resolveHardwareTransaction,
    toHexQuantity,
} from "../../../src/utils/hardware/evmTransaction";

const baseTx: HardwareTransactionLike = {
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    data: "0xabcdef",
    gas: 100_000n,
    nonce: 7n,
    value: 1_000n,
};
const chainId = 30n;
const fallbackNonce = 99;

describe("toHexQuantity", () => {
    test("encodes zero as 0x0 (Trezor accepts the short form)", () => {
        expect(toHexQuantity(0)).toBe("0x0");
        expect(toHexQuantity(0n)).toBe("0x0");
    });

    test("encodes positive values as canonical lowercase 0x hex", () => {
        expect(toHexQuantity(255)).toBe("0xff");
        expect(toHexQuantity(1_000_000_000n)).toBe("0x3b9aca00");
    });
});

describe("resolveHardwareTransaction", () => {
    test("uses tx-provided EIP-1559 fees over fee-data fallback", () => {
        const feeData: HardwareFeeData = {
            maxFeePerGas: 11n,
            maxPriorityFeePerGas: 1n,
            gasPrice: 5n,
        };
        const tx = {
            ...baseTx,
            maxFeePerGas: 99n,
            maxPriorityFeePerGas: 9n,
        };

        const resolved = resolveHardwareTransaction(
            tx,
            chainId,
            fallbackNonce,
            feeData,
        );

        expect(resolved).toMatchObject({
            type: 2,
            chainId,
            data: "0xabcdef",
            gasLimit: 100_000n,
            nonce: 7,
            to: baseTx.to,
            value: 1_000n,
            maxFeePerGas: 99n,
            maxPriorityFeePerGas: 9n,
        });
    });

    test("falls back to fee-data EIP-1559 fees when tx omits them and type=2", () => {
        const feeData: HardwareFeeData = {
            maxFeePerGas: 11n,
            maxPriorityFeePerGas: 1n,
            gasPrice: 5n,
        };
        const tx = { ...baseTx, type: 2 };

        const resolved = resolveHardwareTransaction(
            tx,
            chainId,
            fallbackNonce,
            feeData,
        );

        expect(resolved.type).toBe(2);
        if (resolved.type !== 2) throw new Error("expected eip-1559");
        expect(resolved.maxFeePerGas).toBe(11n);
        expect(resolved.maxPriorityFeePerGas).toBe(1n);
    });

    test("uses tx gasPrice for legacy and never returns EIP-1559 fields", () => {
        const feeData: HardwareFeeData = {
            maxFeePerGas: 11n,
            maxPriorityFeePerGas: 1n,
            gasPrice: 5n,
        };
        const tx = { ...baseTx, gasPrice: 7n };

        const resolved = resolveHardwareTransaction(
            tx,
            chainId,
            fallbackNonce,
            feeData,
        );

        expect(resolved.type).toBe(0);
        if (resolved.type !== 0) throw new Error("expected legacy");
        expect(resolved.gasPrice).toBe(7n);
        expect("maxFeePerGas" in resolved).toBe(false);
    });

    test("defaults to EIP-1559 when only EIP-1559 fee-data is present and tx specifies neither", () => {
        const feeData: HardwareFeeData = {
            maxFeePerGas: 11n,
            maxPriorityFeePerGas: 1n,
        };

        const resolved = resolveHardwareTransaction(
            baseTx,
            chainId,
            fallbackNonce,
            feeData,
        );

        expect(resolved.type).toBe(2);
    });

    test("defaults to legacy when only gasPrice is present", () => {
        const feeData: HardwareFeeData = { gasPrice: 5n };

        const resolved = resolveHardwareTransaction(
            baseTx,
            chainId,
            fallbackNonce,
            feeData,
        );

        expect(resolved.type).toBe(0);
        if (resolved.type !== 0) throw new Error("expected legacy");
        expect(resolved.gasPrice).toBe(5n);
    });

    test("uses fallback nonce when tx omits one", () => {
        const feeData: HardwareFeeData = { gasPrice: 5n };
        const txWithoutNonce = { ...baseTx, nonce: undefined };

        const resolved = resolveHardwareTransaction(
            txWithoutNonce,
            chainId,
            fallbackNonce,
            feeData,
        );

        expect(resolved.nonce).toBe(fallbackNonce);
    });

    test("throws on missing gas limit when no fallback supplied", () => {
        const feeData: HardwareFeeData = { gasPrice: 5n };
        const tx = { ...baseTx, gas: undefined, gasLimit: undefined };

        expect(() =>
            resolveHardwareTransaction(tx, chainId, fallbackNonce, feeData),
        ).toThrow("missing transaction gas limit");
    });

    test("uses fallback gas when tx omits gas/gasLimit", () => {
        const feeData: HardwareFeeData = { gasPrice: 5n };
        const tx = { ...baseTx, gas: undefined, gasLimit: undefined };

        const resolved = resolveHardwareTransaction(
            tx,
            chainId,
            fallbackNonce,
            feeData,
            123_456n,
        );

        expect(resolved.gasLimit).toBe(123_456n);
    });

    test("prefers tx-provided gas over fallback gas", () => {
        const feeData: HardwareFeeData = { gasPrice: 5n };

        const resolved = resolveHardwareTransaction(
            baseTx,
            chainId,
            fallbackNonce,
            feeData,
            999_999n,
        );

        expect(resolved.gasLimit).toBe(100_000n);
    });

    test("throws when EIP-1559 type=2 but fee-data lacks 1559 fields", () => {
        const feeData: HardwareFeeData = { gasPrice: 5n };
        const tx = { ...baseTx, type: 2 };

        expect(() =>
            resolveHardwareTransaction(tx, chainId, fallbackNonce, feeData),
        ).toThrow("missing EIP-1559 fee data");
    });

    test("throws when legacy type=0 but fee-data lacks gasPrice", () => {
        const feeData: HardwareFeeData = {
            maxFeePerGas: 11n,
            maxPriorityFeePerGas: 1n,
        };
        const tx = { ...baseTx, type: 0 };

        expect(() =>
            resolveHardwareTransaction(tx, chainId, fallbackNonce, feeData),
        ).toThrow("missing legacy gas price");
    });

    test("propagates chain id verbatim (used by EIP-155 v computation)", () => {
        const feeData: HardwareFeeData = { gasPrice: 5n };
        const resolved = resolveHardwareTransaction(
            baseTx,
            56n,
            fallbackNonce,
            feeData,
        );
        expect(resolved.chainId).toBe(56n);
    });
});
