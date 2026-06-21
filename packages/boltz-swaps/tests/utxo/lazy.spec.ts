import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Logger } from "../../src/logger.ts";

const h = vi.hoisted(() => {
    const SECP = { __secp: true } as const;

    const state = {
        SECP,
        secp: SECP as unknown,
        useDefaultExport: true,
        zkpRejection: undefined as Error | undefined,
        initImpl: undefined as ((secp: unknown) => void) | undefined,
        confidentialImpl: undefined as ((secp: unknown) => void) | undefined,
    };

    const zkpFactory = vi.fn(async () => {
        if (state.zkpRejection !== undefined) {
            throw state.zkpRejection;
        }
        return state.secp;
    });

    const init = vi.fn((secp: unknown) => {
        if (state.initImpl !== undefined) {
            state.initImpl(secp);
        }
    });

    const Confidential = vi.fn(function (this: unknown, secp: unknown) {
        if (state.confidentialImpl !== undefined) {
            state.confidentialImpl(secp);
        }
    });

    return { state, zkpFactory, init, Confidential };
});

vi.mock("@vulpemventures/secp256k1-zkp", () => {
    if (h.state.useDefaultExport) {
        return { default: h.zkpFactory };
    }
    return h.zkpFactory;
});

vi.mock("boltz-core/liquid", () => ({ init: h.init }));

vi.mock("liquidjs-lib", () => ({
    confidential: { Confidential: h.Confidential },
}));

const makeLogger = (): Logger => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
});

const freshLoad = async () => {
    vi.resetModules();
    const logger = makeLogger();
    const loggerMod = await import("../../src/logger.ts");
    loggerMod.setLogger(logger);
    const { utxoSecp } = await import("../../src/utxo/lazy.ts");
    return { utxoSecp, logger };
};

describe("utxoSecp Loader", () => {
    beforeEach(() => {
        h.state.secp = h.state.SECP;
        h.state.useDefaultExport = true;
        h.state.zkpRejection = undefined;
        h.state.initImpl = undefined;
        h.state.confidentialImpl = undefined;
        h.zkpFactory.mockClear();
        h.init.mockClear();
        h.Confidential.mockClear();
    });

    afterEach(() => {
        vi.resetModules();
    });

    test("happy path: Promise.all loads modules, init(SECP) once, Confidential(SECP), secpZkp === SECP", async () => {
        const { utxoSecp, logger } = await freshLoad();

        const modules = await utxoSecp.get();

        expect(h.zkpFactory).toHaveBeenCalledTimes(1);
        expect(h.zkpFactory).toHaveBeenCalledWith();

        expect(h.init).toHaveBeenCalledTimes(1);
        expect(h.init).toHaveBeenCalledWith(h.state.SECP);

        expect(h.Confidential).toHaveBeenCalledTimes(1);
        expect(h.Confidential).toHaveBeenCalledWith(h.state.SECP);

        expect(modules.secpZkp).toBe(h.state.SECP);
        expect(modules.confidential).toBeInstanceOf(h.Confidential);

        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith(
            "Loading Secp256k1ZKP modules",
        );
    });

    describe("ESM default-export interop fallback (zkpModule.default ?? zkpModule)", () => {
        test("Case A: factory under `.default` is selected", async () => {
            h.state.useDefaultExport = true;

            const { utxoSecp } = await freshLoad();
            const modules = await utxoSecp.get();

            expect(h.zkpFactory).toHaveBeenCalledTimes(1);
            expect(h.init).toHaveBeenCalledTimes(1);
            expect(h.init).toHaveBeenCalledWith(h.state.SECP);
            expect(h.Confidential).toHaveBeenCalledWith(h.state.SECP);
            expect(modules.secpZkp).toBe(h.state.SECP);
        });

        test("Case B: namespace itself is callable (no `.default`) — fallback branch resolves", async () => {
            h.state.useDefaultExport = false;

            const { utxoSecp } = await freshLoad();
            const modules = await utxoSecp.get();

            expect(h.zkpFactory).toHaveBeenCalledTimes(1);
            expect(h.init).toHaveBeenCalledTimes(1);
            expect(h.init).toHaveBeenCalledWith(h.state.SECP);
            expect(h.Confidential).toHaveBeenCalledWith(h.state.SECP);
            expect(modules.secpZkp).toBe(h.state.SECP);
        });
    });

    describe("Loader.get memoization", () => {
        test("zkp factory and init each run once across two get() calls and return the identical object", async () => {
            const { utxoSecp, logger } = await freshLoad();

            const first = await utxoSecp.get();
            const second = await utxoSecp.get();

            expect(h.zkpFactory).toHaveBeenCalledTimes(1);
            expect(h.init).toHaveBeenCalledTimes(1);
            expect(h.Confidential).toHaveBeenCalledTimes(1);

            expect(first).toBe(second);

            expect(logger.info).toHaveBeenCalledTimes(1);
        });
    });

    describe("error propagation and retry-after-failure", () => {
        test("rejection in the zkp factory propagates out of get()", async () => {
            const failure = new Error("wasm fail");
            h.state.zkpRejection = failure;

            const { utxoSecp } = await freshLoad();

            await expect(utxoSecp.get()).rejects.toThrow("wasm fail");

            expect(h.init).not.toHaveBeenCalled();
            expect(h.Confidential).not.toHaveBeenCalled();
        });

        test("a throw inside init(secp) rejects get()", async () => {
            h.state.initImpl = () => {
                throw new Error("init boom");
            };

            const { utxoSecp } = await freshLoad();

            await expect(utxoSecp.get()).rejects.toThrow("init boom");
            expect(h.zkpFactory).toHaveBeenCalledTimes(1);
            expect(h.Confidential).not.toHaveBeenCalled();
        });

        test("a throw inside new Confidential(secp) rejects get()", async () => {
            h.state.confidentialImpl = () => {
                throw new Error("confidential boom");
            };

            const { utxoSecp } = await freshLoad();

            await expect(utxoSecp.get()).rejects.toThrow("confidential boom");
            expect(h.init).toHaveBeenCalledTimes(1);
        });

        test("modules are not cached on failure: a later get() retries and succeeds", async () => {
            const failure = new Error("wasm fail");
            h.state.zkpRejection = failure;

            const { utxoSecp, logger } = await freshLoad();

            await expect(utxoSecp.get()).rejects.toThrow("wasm fail");
            expect(h.zkpFactory).toHaveBeenCalledTimes(1);

            h.state.zkpRejection = undefined;
            const modules = await utxoSecp.get();

            expect(h.zkpFactory).toHaveBeenCalledTimes(2);
            expect(h.init).toHaveBeenCalledTimes(1);
            expect(h.Confidential).toHaveBeenCalledTimes(1);
            expect(modules.secpZkp).toBe(h.state.SECP);

            expect(logger.info).toHaveBeenCalledTimes(2);
            expect(logger.info).toHaveBeenNthCalledWith(
                1,
                "Loading Secp256k1ZKP modules",
            );
            expect(logger.info).toHaveBeenNthCalledWith(
                2,
                "Loading Secp256k1ZKP modules",
            );
        });
    });
});
