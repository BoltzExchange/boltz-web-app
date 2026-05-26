import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";

import SwapLimits from "../../src/components/SwapLimits";

const renderLimits = (
    overrides: Partial<Parameters<typeof SwapLimits>[0]> = {},
) => {
    const onSelectAmount = vi.fn();
    const result = render(() => (
        <SwapLimits
            maximum={2_000_000}
            maxLabel="Max"
            loading={false}
            onSelectAmount={onSelectAmount}
            {...overrides}
        />
    ));
    return { ...result, onSelectAmount };
};

describe("SwapLimits", () => {
    it("renders the max button with its label", () => {
        renderLimits();

        expect(screen.queryByTestId("limit-min-button")).toBeNull();
        expect(screen.getByTestId("limit-max-button")).toHaveTextContent("Max");
    });

    it("does not render when not loading and the maximum is zero", () => {
        const { container } = renderLimits({ maximum: 0 });

        expect(container.querySelector(".amount-limits")).toBeNull();
        expect(screen.queryByTestId("limit-min-button")).toBeNull();
        expect(screen.queryByTestId("limit-max-button")).toBeNull();
    });

    it("renders while loading even when limits are zero", () => {
        renderLimits({ maximum: 0, loading: true });

        expect(screen.queryByTestId("limit-min-button")).toBeNull();
        expect(screen.getByTestId("limit-max-button")).toBeInTheDocument();
    });

    it("calls onSelectAmount with the maximum when max is clicked", () => {
        const { onSelectAmount } = renderLimits({ maximum: 9_999 });

        fireEvent.click(screen.getByTestId("limit-max-button"));

        expect(onSelectAmount).toHaveBeenCalledTimes(1);
        expect(onSelectAmount).toHaveBeenCalledWith(9_999);
    });

    it("can enable the max button independently from the displayed maximum", () => {
        const onSelectMaximum = vi.fn();
        const { onSelectAmount } = renderLimits({
            maximum: 0,
            maximumEnabled: true,
            onSelectMaximum,
        });

        fireEvent.click(screen.getByTestId("limit-max-button"));

        expect(onSelectMaximum).toHaveBeenCalledTimes(1);
        expect(onSelectAmount).not.toHaveBeenCalled();
    });

    it("disables the max button and shows a skeleton while loading", () => {
        const { container, onSelectAmount } = renderLimits({ loading: true });

        const maxBtn = screen.getByTestId("limit-max-button");

        expect(maxBtn).toBeDisabled();
        expect(maxBtn).toHaveAttribute("aria-busy", "true");
        expect(container.querySelectorAll(".skeleton")).toHaveLength(1);
        expect(maxBtn).not.toHaveTextContent("Max");

        fireEvent.click(maxBtn);
        expect(onSelectAmount).not.toHaveBeenCalled();
    });

    it("uses the labels as accessible names", () => {
        renderLimits({ maxLabel: "Maximum" });

        expect(
            screen.getByRole("button", { name: "Maximum" }),
        ).toBeInTheDocument();
    });
});
