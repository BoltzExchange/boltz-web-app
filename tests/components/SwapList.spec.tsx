import { fireEvent, render, screen } from "@solidjs/testing-library";
import { SwapType } from "boltz-swaps/types";

import SwapList, { type Swap } from "../../src/components/SwapList";
import { BTC, LN } from "../../src/consts/Assets";
import { RescueAction } from "../../src/utils/rescue";
import type { SomeSwap } from "../../src/utils/swapCreator";
import { contextWrapper } from "../helper";

describe("SwapList", () => {
    it("should sort correctly", () => {
        const swapsSorted: SomeSwap[] = [
            {
                id: "first",
                date: new Date().getTime(),
                assetSend: BTC,
                assetReceive: LN,
            } as SomeSwap,
            {
                id: "second",
                date: 1454533445545,
                assetSend: BTC,
                assetReceive: LN,
            } as SomeSwap,
            {
                id: "third",
                date: 1,
                assetSend: BTC,
                assetReceive: LN,
            } as SomeSwap,
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
                    action={(swap) => swap.status ?? ""}
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const childNodes: ChildNode[] = [];
        firstChild!.childNodes.forEach((node) => {
            if (node.nodeName === "HR") return;
            childNodes.push(node);
        });

        expect(childNodes.length).toEqual(swapsSignal().length);

        for (const [i, swap] of childNodes.entries()) {
            expect(swap.textContent?.includes(swapsSorted[i].id)).toEqual(true);
        }
    });

    it("should render rows as real links when no onClick is provided", () => {
        const swap = {
            id: "link-swap",
            date: new Date().getTime(),
            assetSend: BTC,
            assetReceive: LN,
        } as SomeSwap;

        render(
            () => <SwapList swapsSignal={() => [swap]} action={() => "view"} />,
            { wrapper: contextWrapper },
        );

        const item = screen.getByTestId(`swaplist-item-${swap.id}`);
        expect(item.tagName).toEqual("A");
        expect(item.getAttribute("href")).toEqual(`/swap/${swap.id}`);
    });

    it("should display local commitment ids as eight characters without changing the link target", () => {
        const swap = {
            id: "commitment-12345678-1234-1234-1234-123456789abc",
            type: SwapType.Commitment,
            date: new Date().getTime(),
            assetSend: BTC,
            assetReceive: LN,
        } as SomeSwap;

        render(
            () => <SwapList swapsSignal={() => [swap]} action={() => "view"} />,
            { wrapper: contextWrapper },
        );

        const item = screen.getByTestId(`swaplist-item-${swap.id}`);
        expect(item.getAttribute("href")).toEqual(`/swap/${swap.id}`);
        expect(item.textContent).toContain("12345678");
        expect(item.textContent).not.toContain(swap.id);
    });

    it("should not render rows as links when a custom onClick is provided", () => {
        const swap = {
            id: "click-swap",
            date: new Date().getTime(),
            assetSend: BTC,
            assetReceive: LN,
        } as SomeSwap;

        const onClick = vi.fn();
        render(
            () => (
                <SwapList
                    swapsSignal={() => [swap]}
                    action={() => "view"}
                    onClick={onClick}
                />
            ),
            { wrapper: contextWrapper },
        );

        const item = screen.getByTestId(`swaplist-item-${swap.id}`);
        expect(item.tagName).toEqual("DIV");
        expect(item.getAttribute("href")).toBeNull();

        fireEvent.click(item);
        expect(onClick).toHaveBeenCalledWith(swap);
    });

    it("should render disabled rows as non-link divs", () => {
        const swap = {
            id: "disabled-swap",
            date: new Date().getTime(),
            assetSend: BTC,
            assetReceive: LN,
            action: RescueAction.Successful,
        } as Swap;

        render(
            () => <SwapList swapsSignal={() => [swap]} action={() => "done"} />,
            { wrapper: contextWrapper },
        );

        const item = screen.getByTestId(`swaplist-item-${swap.id}`);
        expect(item.tagName).toEqual("DIV");
        expect(item.getAttribute("href")).toBeNull();
        expect(item.className).toContain("disabled");
    });

    it("should not trigger row click when delete button is clicked", () => {
        const swap = {
            id: "delete-swap",
            date: new Date().getTime(),
            assetSend: BTC,
            assetReceive: LN,
        } as SomeSwap;

        const onClick = vi.fn();
        vi.spyOn(window, "confirm").mockReturnValue(false);

        render(
            () => (
                <SwapList
                    swapsSignal={() => [swap]}
                    action={() => "view"}
                    onClick={onClick}
                    onDelete={() => Promise.resolve()}
                />
            ),
            { wrapper: contextWrapper },
        );

        fireEvent.click(screen.getByTestId(`delete-swap-${swap.id}`));
        expect(onClick).not.toHaveBeenCalled();
    });

    it("should render N-1 separators between N swap rows", () => {
        const swaps: SomeSwap[] = [
            { id: "a", date: 3, assetSend: BTC, assetReceive: LN },
            { id: "b", date: 2, assetSend: BTC, assetReceive: LN },
            { id: "c", date: 1, assetSend: BTC, assetReceive: LN },
        ] as SomeSwap[];

        const { container } = render(
            () => (
                <SwapList
                    swapsSignal={() => swaps}
                    action={() => ""}
                    surroundingSeparators={false}
                />
            ),
            { wrapper: contextWrapper },
        );

        expect(container.querySelectorAll("hr").length).toEqual(
            swaps.length - 1,
        );
    });
});
