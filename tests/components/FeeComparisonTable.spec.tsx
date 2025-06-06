import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";

import FeeComparisonTable from "../../src/components/FeeComparisonTable";
import { TestComponent, contextWrapper } from "../helper";
import { pairs } from "../pairs";

describe("FeeComparisonTable", () => {
    it("should show opportunities where pro fee is lower than regular fee", () => {
        const proPairs = structuredClone(pairs);
        const regularPairs = structuredClone(pairs);
        proPairs.chain.BTC["L-BTC"].fees.percentage = 0.1;
        regularPairs.chain.BTC["L-BTC"].fees.percentage = 0.5;
        render(
            () => (
                <>
                    <TestComponent />
                    <FeeComparisonTable
                        proPairs={proPairs}
                        regularPairs={regularPairs}
                        onSelect={() => {}}
                    />
                </>
            ),
            { wrapper: contextWrapper },
        );
        expect(screen.getByText("0.1%")).toBeInTheDocument();
        expect(screen.getByText("0.5%")).toBeInTheDocument();
    });

    it("should call onSelect when an opportunity row is clicked", () => {
        const proPairs = structuredClone(pairs);
        const regularPairs = structuredClone(pairs);
        proPairs.chain.BTC["L-BTC"].fees.percentage = 0.1;
        regularPairs.chain.BTC["L-BTC"].fees.percentage = 0.5;
        const onSelect = vi.fn();
        render(
            () => (
                <>
                    <TestComponent />
                    <FeeComparisonTable
                        proPairs={proPairs}
                        regularPairs={regularPairs}
                        onSelect={onSelect}
                    />
                </>
            ),
            { wrapper: contextWrapper },
        );
        const row = screen.getByText("0.1%")?.closest("tr");
        if (row) fireEvent.click(row);
        expect(onSelect).toHaveBeenCalled();
    });

    it("should show fallback when no opportunities are found", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <FeeComparisonTable
                        proPairs={pairs}
                        regularPairs={pairs}
                        onSelect={() => {}}
                    />
                </>
            ),
            { wrapper: contextWrapper },
        );
        expect(
            screen.getByTestId("no-opportunities-found"),
        ).toBeInTheDocument();
    });
});
