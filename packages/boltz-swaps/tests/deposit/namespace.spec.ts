import { afterEach, describe, expect, it, vi } from "vitest";

import * as quoteMod from "../../src/deposit/quote.ts";
import * as watcherMod from "../../src/deposit/watcher.ts";

// Anvil/Hardhat default mnemonic — same vectors as derivation.spec.
const MNEMONIC = "test test test test test test test test test test test junk";

vi.mock("../../src/deposit/quote.ts", () => ({
    previewDepositQuote: vi.fn(async () => ({ q: 1 })),
}));

vi.mock("../../src/deposit/watcher.ts", () => ({
    createWatcher: vi.fn(async () => ({ w: "create" })),
    resumeWatcher: vi.fn(async () => ({ w: "resume" })),
}));

// Import after mocks are registered.
const { createDepositNamespace } = await import("../../src/deposit/index.ts");

const previewDepositQuote = vi.mocked(quoteMod.previewDepositQuote);
const createWatcher = vi.mocked(watcherMod.createWatcher);
const resumeWatcher = vi.mocked(watcherMod.resumeWatcher);

describe("createDepositNamespace", () => {
    afterEach(() => vi.clearAllMocks());

    describe("derive", () => {
        it("defaults index to 0 and returns the HD-derived address", () => {
            const ns = createDepositNamespace();
            expect(ns.derive({ mnemonic: MNEMONIC })).toEqual({
                index: 0,
                address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            });
        });

        it("passes the index through to derivation", () => {
            const ns = createDepositNamespace();
            expect(ns.derive({ mnemonic: MNEMONIC, index: 1 })).toEqual({
                index: 1,
                address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            });
        });
    });

    describe("delegation", () => {
        it("forwards quote to previewDepositQuote and returns its result", async () => {
            const ns = createDepositNamespace();
            const args = {
                sourceAsset: "USDC" as never,
                amount: 5n,
                target: { type: "btc" } as never,
            };
            const result = await ns.quote(args);
            expect(previewDepositQuote).toHaveBeenCalledWith(args);
            expect(result).toEqual({ q: 1 });
        });

        it("forwards createWatcher to watcher.createWatcher", async () => {
            const ns = createDepositNamespace();
            const args = { mnemonic: MNEMONIC } as never;
            const result = await ns.createWatcher(args);
            expect(createWatcher).toHaveBeenCalledWith(args);
            expect(resumeWatcher).not.toHaveBeenCalled();
            expect(result).toEqual({ w: "create" });
        });

        it("forwards resumeWatcher to watcher.resumeWatcher, never createWatcher", async () => {
            const ns = createDepositNamespace();
            const args = { mnemonic: MNEMONIC } as never;
            const result = await ns.resumeWatcher(args);
            expect(resumeWatcher).toHaveBeenCalledWith(args);
            // A resume->create mis-wire would silently re-bridge resumed deposits.
            expect(createWatcher).not.toHaveBeenCalled();
            expect(result).toEqual({ w: "resume" });
        });
    });
});
