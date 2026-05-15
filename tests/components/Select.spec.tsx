import { fireEvent, render, screen } from "@solidjs/testing-library";

import Select from "../../src/components/Select";

describe("Select", () => {
    test("should render one option per entry with the value as default label", () => {
        render(() => (
            <Select
                value="a"
                options={["a", "b", "c"]}
                onChange={() => {}}
                data-testid="picker"
            />
        ));

        const select = screen.getByTestId("picker") as HTMLSelectElement;
        expect(select.value).toBe("a");
        expect(select.options).toHaveLength(3);
        expect(
            Array.from(select.options).map((opt) => opt.textContent),
        ).toEqual(["a", "b", "c"]);
    });

    test("should display the labelFor result instead of the raw value", () => {
        const labelFor = (value: string) =>
            ({ en: "English", de: "Deutsch" })[value] ?? value;

        render(() => (
            <Select
                value="en"
                options={["en", "de"]}
                labelFor={labelFor}
                onChange={() => {}}
                data-testid="picker"
            />
        ));

        const select = screen.getByTestId("picker") as HTMLSelectElement;
        expect(
            Array.from(select.options).map((opt) => opt.textContent),
        ).toEqual(["English", "Deutsch"]);
        // The underlying value remains the raw code.
        expect(Array.from(select.options).map((opt) => opt.value)).toEqual([
            "en",
            "de",
        ]);
    });

    test("should invoke onChange with the selected value", () => {
        const onChange = vi.fn();

        render(() => (
            <Select
                value="a"
                options={["a", "b"]}
                onChange={onChange}
                data-testid="picker"
            />
        ));

        const select = screen.getByTestId("picker") as HTMLSelectElement;
        fireEvent.change(select, { target: { value: "b" } });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith("b");
    });
});
