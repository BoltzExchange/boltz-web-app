import { Router } from "@solidjs/router";
import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import SwapList from "../../src/components/SwapList.jsx";

describe("SwapList", () => {
    it("should sort correctly", async () => {
        const swapsSorted = [
            { id: "first", date: new Date().getTime() },
            { id: "second", date: 1454533445545 },
            { id: "third", date: 1 },
        ];
        const swapsSignal = () => [
            swapsSorted[2],
            swapsSorted[0],
            swapsSorted[1],
        ];

        const {
            container: { firstChild: firstChild },
        } = render(() => (
            <Router>
                <SwapList
                    swapsSignal={swapsSignal}
                    setSwapSignal={() => {
                        return undefined;
                    }}
                />
            </Router>
        ));

        expect(firstChild.childNodes.length).toEqual(swapsSignal().length);

        for (const [i, swap] of firstChild.childNodes.entries()) {
            expect(swap.textContent.includes(swapsSorted[i].id)).toEqual(true);
        }
    });
});
