import { fireEvent, render, screen } from "@solidjs/testing-library";

import Slippage, { roundPercent } from "../../src/components/settings/Slippage";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

describe("roundPercent", () => {
    test.each`
        input                  | expected
        ${0.30000000000000004} | ${0.3}
        ${0.1}                 | ${0.1}
        ${0.9999999999999999}  | ${1}
        ${1.0000000000000002}  | ${1}
        ${2.4000000000000004}  | ${2.4}
        ${5}                   | ${5}
        ${0}                   | ${0}
        ${3.55}                | ${3.6}
    `("roundPercent($input) === $expected", ({ input, expected }) => {
        expect(roundPercent(input)).toBe(expected);
    });
});

describe("Slippage", () => {
    test("should display slippage as rounded percentage", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Slippage />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setSlippage(0.003);

        const input = screen.getByRole("spinbutton") as HTMLInputElement;
        expect(Number(input.value)).toBe(0.3);
    });

    test("should store rounded decimal on change", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Slippage />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const input = screen.getByRole("spinbutton") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.3" } });

        expect(globalSignals.slippage()).toBe(0.003);
    });

    test("should clamp values to range", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Slippage />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const input = screen.getByRole("spinbutton") as HTMLInputElement;

        fireEvent.change(input, { target: { value: "10" } });
        expect(globalSignals.slippage()).toBe(0.05);

        fireEvent.change(input, { target: { value: "0.01" } });
        expect(globalSignals.slippage()).toBe(0.001);
    });

    test("should ignore NaN input", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Slippage />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setSlippage(0.01);
        const input = screen.getByRole("spinbutton") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "abc" } });

        expect(globalSignals.slippage()).toBe(0.01);
    });

    test("round-trip should not accumulate floating-point error", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Slippage />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const input = screen.getByRole("spinbutton") as HTMLInputElement;

        for (const pct of [0.1, 0.2, 0.3, 0.7, 1.1, 2.9, 4.8]) {
            fireEvent.change(input, { target: { value: String(pct) } });
            const stored = globalSignals.slippage();
            const displayed = roundPercent(stored * 100);
            expect(displayed).toBe(pct);
        }
    });
});
