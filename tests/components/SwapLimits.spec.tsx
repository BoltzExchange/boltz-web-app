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
            minimum={1_000}
            maximum={2_000_000}
            minLabel="Min"
            maxLabel="Max"
            loading={false}
            onSelectAmount={onSelectAmount}
            {...overrides}
        />
    ));
    return { ...result, onSelectAmount };
};

describe("SwapLimits", () => {
    it("renders min and max buttons with their labels", () => {
        renderLimits();

        expect(screen.getByTestId("limit-min-button")).toHaveTextContent("Min");
        expect(screen.getByTestId("limit-max-button")).toHaveTextContent("Max");
    });

    it("does not render when not loading and both limits are zero", () => {
        const { container } = renderLimits({ minimum: 0, maximum: 0 });

        expect(container.querySelector(".amount-limits")).toBeNull();
        expect(screen.queryByTestId("limit-min-button")).toBeNull();
        expect(screen.queryByTestId("limit-max-button")).toBeNull();
    });

    it("renders while loading even when limits are zero", () => {
        renderLimits({ minimum: 0, maximum: 0, loading: true });

        expect(screen.getByTestId("limit-min-button")).toBeInTheDocument();
        expect(screen.getByTestId("limit-max-button")).toBeInTheDocument();
    });

    it("calls onSelectAmount with the minimum when min is clicked", () => {
        const { onSelectAmount } = renderLimits({ minimum: 1_234 });

        fireEvent.click(screen.getByTestId("limit-min-button"));

        expect(onSelectAmount).toHaveBeenCalledTimes(1);
        expect(onSelectAmount).toHaveBeenCalledWith(1_234);
    });

    it("calls onSelectAmount with the maximum when max is clicked", () => {
        const { onSelectAmount } = renderLimits({ maximum: 9_999 });

        fireEvent.click(screen.getByTestId("limit-max-button"));

        expect(onSelectAmount).toHaveBeenCalledTimes(1);
        expect(onSelectAmount).toHaveBeenCalledWith(9_999);
    });

    it("disables both buttons and shows skeletons while loading", () => {
        const { container, onSelectAmount } = renderLimits({ loading: true });

        const minBtn = screen.getByTestId("limit-min-button");
        const maxBtn = screen.getByTestId("limit-max-button");

        expect(minBtn).toBeDisabled();
        expect(maxBtn).toBeDisabled();
        expect(minBtn).toHaveAttribute("aria-busy", "true");
        expect(maxBtn).toHaveAttribute("aria-busy", "true");
        expect(container.querySelectorAll(".skeleton")).toHaveLength(2);
        expect(minBtn).not.toHaveTextContent("Min");
        expect(maxBtn).not.toHaveTextContent("Max");

        fireEvent.click(minBtn);
        fireEvent.click(maxBtn);
        expect(onSelectAmount).not.toHaveBeenCalled();
    });

    it("disables only the side whose limit is non-positive", () => {
        const { onSelectAmount } = renderLimits({ minimum: 0, maximum: 500 });

        const minBtn = screen.getByTestId("limit-min-button");
        const maxBtn = screen.getByTestId("limit-max-button");

        expect(minBtn).toBeDisabled();
        expect(maxBtn).toBeEnabled();

        fireEvent.click(minBtn);
        expect(onSelectAmount).not.toHaveBeenCalled();

        fireEvent.click(maxBtn);
        expect(onSelectAmount).toHaveBeenCalledWith(500);
    });

    it("uses the labels as accessible names", () => {
        renderLimits({ minLabel: "Minimum", maxLabel: "Maximum" });

        expect(
            screen.getByRole("button", { name: "Minimum" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Maximum" }),
        ).toBeInTheDocument();
    });
});
