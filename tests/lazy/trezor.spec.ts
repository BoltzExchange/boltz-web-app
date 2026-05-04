// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const innerSingleton = {
    init: vi.fn(),
    ethereumGetAddress: vi.fn(),
    ethereumSignTransaction: vi.fn(),
};

afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@trezor/connect-web");
});

describe("trezor lazy loader (esbuild CJS-interop unwrap)", () => {
    test("unwraps the inner default when the bundle exports the namespace", async () => {
        // esbuild's CJS-to-ESM wrap of @trezor/connect-web emits
        // `export default require_lib()` — i.e. the whole `exports` namespace
        // — so the actual TrezorConnect singleton lives at `.default.default`.
        vi.doMock("@trezor/connect-web", () => ({
            default: {
                __esModule: true,
                default: innerSingleton,
                parseConnectSettings: vi.fn(),
            },
        }));

        const trezorLoader = (await import("../../src/lazy/trezor")).default;
        const resolved = await trezorLoader.get();

        expect(resolved).toBe(innerSingleton);
        expect(typeof resolved.ethereumGetAddress).toBe("function");
    });

    test("returns the singleton directly when no extra wrap is present", async () => {
        vi.doMock("@trezor/connect-web", () => ({
            default: innerSingleton,
        }));

        const trezorLoader = (await import("../../src/lazy/trezor")).default;
        const resolved = await trezorLoader.get();

        expect(resolved).toBe(innerSingleton);
    });

    test("caches the resolved module across calls", async () => {
        vi.doMock("@trezor/connect-web", () => ({
            default: innerSingleton,
        }));

        const trezorLoader = (await import("../../src/lazy/trezor")).default;
        const a = await trezorLoader.get();
        const b = await trezorLoader.get();

        expect(a).toBe(b);
    });
});
