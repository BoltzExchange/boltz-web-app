import type { Setter } from "solid-js";
import { describe, expect, test, vi } from "vitest";

import type { GlobalContextType } from "../../src/context/Global";
import { createSwapModifier } from "../../src/hooks/useModifySwap";
import type { SomeSwap } from "../../src/utils/swapCreator";

const makeSwap = (id: string): SomeSwap => ({ id }) as SomeSwap;

describe("createSwapModifier", () => {
    test("syncs the UI signal when the modified swap is displayed", async () => {
        const updated = makeSwap("swap-1");
        const modifySwapStorage = vi.fn(() => Promise.resolve(updated));
        const setSwap = vi.fn();
        const mutator = vi.fn();

        const modifySwap = createSwapModifier(
            modifySwapStorage as unknown as GlobalContextType["modifySwapStorage"],
            () => makeSwap("swap-1"),
            setSwap as unknown as Setter<SomeSwap | null>,
        );
        const result = await modifySwap("swap-1", mutator);

        expect(modifySwapStorage).toHaveBeenCalledWith("swap-1", mutator);
        expect(setSwap).toHaveBeenCalledWith(updated);
        expect(result).toBe(updated);
    });

    test("does not sync the UI signal for a different swap", async () => {
        const updated = makeSwap("swap-2");
        const modifySwapStorage = vi.fn(() => Promise.resolve(updated));
        const setSwap = vi.fn();

        const modifySwap = createSwapModifier(
            modifySwapStorage as unknown as GlobalContextType["modifySwapStorage"],
            () => makeSwap("swap-1"),
            setSwap as unknown as Setter<SomeSwap | null>,
        );
        const result = await modifySwap("swap-2", vi.fn());

        expect(setSwap).not.toHaveBeenCalled();
        expect(result).toBe(updated);
    });

    test("passes through null without syncing", async () => {
        const modifySwapStorage = vi.fn(() => Promise.resolve(null));
        const setSwap = vi.fn();

        const modifySwap = createSwapModifier(
            modifySwapStorage as unknown as GlobalContextType["modifySwapStorage"],
            () => makeSwap("swap-1"),
            setSwap as unknown as Setter<SomeSwap | null>,
        );
        const result = await modifySwap("swap-1", vi.fn());

        expect(setSwap).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    test("does not sync when no swap is displayed", async () => {
        const updated = makeSwap("swap-1");
        const modifySwapStorage = vi.fn(() => Promise.resolve(updated));
        const setSwap = vi.fn();

        const modifySwap = createSwapModifier(
            modifySwapStorage as unknown as GlobalContextType["modifySwapStorage"],
            () => null,
            setSwap as unknown as Setter<SomeSwap | null>,
        );
        await modifySwap("swap-1", vi.fn());

        expect(setSwap).not.toHaveBeenCalled();
    });
});
