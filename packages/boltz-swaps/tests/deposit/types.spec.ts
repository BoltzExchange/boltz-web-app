import { DepositPhase, isTerminalPhase } from "boltz-swaps/deposit";
import { describe, expect, it } from "vitest";

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
