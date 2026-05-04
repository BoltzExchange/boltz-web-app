import { fireEvent, render, screen } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";

import RescueFileInput from "../../src/components/RescueFileInput";
import i18n from "../../src/i18n/i18n";
import { contextWrapper } from "../helper";

const placeholderText = i18n.en.upload_rescue_key;
const clearButtonTestId = "rescueFileInputClear";

const renderInput = (
    overrides: Partial<Parameters<typeof RescueFileInput>[0]> = {},
) => {
    const onChange = overrides.onChange ?? vi.fn();
    const onClear = overrides.onClear ?? vi.fn();

    const result = render(
        () => (
            <RescueFileInput
                id="rescueFileInput"
                data-testid="rescueFileInput"
                {...overrides}
                onChange={onChange}
                onClear={onClear}
            />
        ),
        { wrapper: contextWrapper },
    );

    return {
        ...result,
        onChange,
        onClear,
        getInput: () =>
            screen.getByTestId("rescueFileInput") as HTMLInputElement,
    };
};

const makeFile = (name = "rescue.json") =>
    new File([JSON.stringify({})], name, { type: "application/json" });

describe("RescueFileInput", () => {
    test("renders the placeholder and no clear button when empty", () => {
        renderInput();

        expect(screen.getByText(placeholderText)).toBeInTheDocument();
        expect(screen.queryByTestId(clearButtonTestId)).not.toBeInTheDocument();
    });

    test("forwards required, disabled and accept attributes to the native input", () => {
        const { getInput } = renderInput({
            required: true,
            disabled: true,
        });

        const input = getInput();
        expect(input.type).toBe("file");
        expect(input.required).toBe(true);
        expect(input.disabled).toBe(true);
        expect(input.accept).toContain("application/json");
    });

    test("shows the filename and clear button after a file is uploaded", async () => {
        const user = userEvent.setup();
        const { getInput, onChange } = renderInput();

        await user.upload(getInput(), makeFile("rescue.json"));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(screen.getByText("rescue.json")).toBeInTheDocument();
        expect(screen.queryByText(placeholderText)).not.toBeInTheDocument();
        expect(screen.getByTestId(clearButtonTestId)).toBeInTheDocument();
    });

    test("clicking clear calls onClear, restores the placeholder and resets the input", async () => {
        const user = userEvent.setup();
        const { getInput, onClear } = renderInput();

        await user.upload(getInput(), makeFile("rescue.json"));
        fireEvent.click(screen.getByTestId(clearButtonTestId));

        expect(onClear).toHaveBeenCalledTimes(1);
        expect(screen.getByText(placeholderText)).toBeInTheDocument();
        expect(screen.queryByTestId(clearButtonTestId)).not.toBeInTheDocument();
        expect(getInput().value).toBe("");
    });

    test("uses the displayFileName prop when provided", () => {
        renderInput({ displayFileName: "external.json" });

        expect(screen.getByText("external.json")).toBeInTheDocument();
        expect(screen.queryByText(placeholderText)).not.toBeInTheDocument();
        expect(screen.getByTestId(clearButtonTestId)).toBeInTheDocument();
    });

    test("hides the clear button in display mode when displayFileName is empty", async () => {
        const user = userEvent.setup();
        const { getInput } = renderInput({ displayFileName: "" });

        await user.upload(getInput(), makeFile("rescue.json"));

        expect(screen.getByText(placeholderText)).toBeInTheDocument();
        expect(screen.queryByTestId(clearButtonTestId)).not.toBeInTheDocument();
    });
});
