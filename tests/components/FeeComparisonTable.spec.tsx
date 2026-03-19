import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";

import FeeComparisonTable from "../../src/components/FeeComparisonTable";
import { TestComponent, contextWrapper, globalSignals } from "../helper";
import { pairs } from "../pairs";

afterEach(() => {
    localStorage.clear();
});

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

    it("should hide non-bitcoin opportunities when bitcoinOnly is enabled", () => {
        const proPairs = structuredClone(pairs);
        const regularPairs = structuredClone(pairs);
        proPairs.chain.BTC["L-BTC"].fees.percentage = 0.1;
        regularPairs.chain.BTC["L-BTC"].fees.percentage = 0.5;
        proPairs.reverse.BTC.BTC.fees.percentage = 0.1;
        regularPairs.reverse.BTC.BTC.fees.percentage = 0.5;

        const { container } = render(
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

        globalSignals.setBitcoinOnly(true);

        expect(
            container.querySelectorAll("tbody .fee-comparison-row"),
        ).toHaveLength(1);
        expect(container.querySelector('[data-asset="LBTC"]')).toBeNull();
        expect(container.querySelector('[data-asset="LN"]')).not.toBeNull();
        expect(container.querySelector('[data-asset="BTC"]')).not.toBeNull();
    });
});
