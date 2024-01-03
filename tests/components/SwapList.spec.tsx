import { Router } from "@solidjs/router";
import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import SwapList from "../../src/components/SwapList";

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
            <Router
                root={() => (
                    <SwapList
                        swapsSignal={swapsSignal}
                        setSwapSignal={() => {
                            return undefined;
                        }}
                    />
                )}
            />
        ));

        const childNodes = [];
        firstChild.childNodes.forEach((node) => {
            if (node.nodeName === "HR") return;
            childNodes.push(node);
        });

        expect(childNodes.length).toEqual(swapsSignal().length);

        for (const [i, swap] of childNodes.entries()) {
            expect(swap.textContent.includes(swapsSorted[i].id)).toEqual(true);
        }
    });
});
