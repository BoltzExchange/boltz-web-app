import { render } from "@solidjs/testing-library";

import SwapList from "../../src/components/SwapList";
import { SomeSwap } from "../../src/utils/swapCreator";
import { contextWrapper } from "../helper";

describe("SwapList", () => {
    it("should sort correctly", () => {
        const swapsSorted: SomeSwap[] = [
            { id: "first", date: new Date().getTime() } as SomeSwap,
            { id: "second", date: 1454533445545 } as SomeSwap,
            { id: "third", date: 1 } as SomeSwap,
        ];
        const swapsSignal = (): SomeSwap[] => [
            swapsSorted[2],
            swapsSorted[0],
            swapsSorted[1],
        ];

        const {
            container: { firstChild: firstChild },
        } = render(
            () => (
                <SwapList
                    swapsSignal={swapsSignal}
                    action={(swap) => swap.status}
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );

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
