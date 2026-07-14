import { describe, expect, it } from "vitest";

import {
    DepositPhase,
    encodeDepositId,
    isTerminalPhase,
} from "../../src/deposit/types.ts";

describe("encodeDepositId", () => {
    it("namespaces identical transaction coordinates by source asset", () => {
        const polygon = encodeDepositId("USDC-POL", "0xabc", 7);
        const base = encodeDepositId("USDC-BASE", "0xabc", 7);

        expect(polygon).toBe("USDC-POL:0xabc:7");
        expect(base).toBe("USDC-BASE:0xabc:7");
        expect(polygon).not.toBe(base);
    });
});

describe("isTerminalPhase", () => {
    it("is true only for Done and Failed", () => {
        expect(isTerminalPhase(DepositPhase.Done)).toBe(true);
        expect(isTerminalPhase(DepositPhase.Failed)).toBe(true);
        for (const p of Object.values(DepositPhase)) {
            if (p !== DepositPhase.Done && p !== DepositPhase.Failed) {
                expect(isTerminalPhase(p)).toBe(false);
            }
        }
    });
});
