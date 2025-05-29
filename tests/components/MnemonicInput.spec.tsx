import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { fireEvent, render, screen } from "@solidjs/testing-library";

import MnemonicInput from "../../src/components/MnemonicInput";
import { TestComponent, contextWrapper } from "../helper";

describe("MnemonicInput", () => {
    it("should autofill the mnemonic when pasting", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicInput onSubmit={() => {}} />
                </>
            ),
            { wrapper: contextWrapper },
        );
        const mnemonic = generateMnemonic(wordlist);

        const inputs = screen.getAllByTestId(/mnemonic-input-\d/);

        fireEvent.paste(inputs[0], {
            clipboardData: {
                getData: () => mnemonic,
            },
        });

        inputs.forEach((input, index) => {
            expect((input as HTMLInputElement).value).toEqual(
                mnemonic.split(" ")[index],
            );
        });
    });

    it("should not autofill the mnemonic when pasting with wrong format", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicInput onSubmit={() => {}} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const invalidMnemonic = "not a mnemonic";

        const inputs = screen.getAllByTestId(/mnemonic-input-\d/);

        fireEvent.paste(inputs[0], {
            clipboardData: {
                getData: () => invalidMnemonic,
            },
        });

        inputs.forEach((input, index) => {
            if (index === 0) {
                expect((input as HTMLInputElement).value).toEqual(
                    invalidMnemonic,
                );
                return;
            }
            expect((input as HTMLInputElement).value).toEqual("");
        });
    });

    it("should change input color to red when inserting wrong word", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicInput onSubmit={() => {}} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const input = screen.getByTestId(/mnemonic-input-0/);

        fireEvent.input(input, { target: { value: "a" } });

        expect(input.classList).toContain("invalid");
    });

    it("should show invalid rescue key message when 12 words are not valid", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicInput onSubmit={() => {}} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const invalidMnemonic =
            "december build funny exact enough video shoe balance bike glimpse voice invalidWord";

        const input = screen.getByTestId(/mnemonic-input-0/);

        fireEvent.paste(input, {
            clipboardData: {
                getData: () => invalidMnemonic,
            },
        });

        const importBtn = screen.getByTestId(
            /import-key-button/,
        ) as HTMLButtonElement;

        expect(importBtn.disabled).toBe(true);
        expect(screen.getByText(/Invalid rescue key/)).toBeDefined();
    });

    it("should change focus to next input when pressing enter or space", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicInput onSubmit={() => {}} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const inputs = screen.getAllByTestId(
            /mnemonic-input-\d/,
        ) as HTMLInputElement[];

        fireEvent.keyDown(inputs[0], { key: "Enter" });
        expect(document.activeElement).toBe(inputs[1]);

        fireEvent.keyDown(inputs[1], { key: " " });
        expect(document.activeElement).toBe(inputs[2]);
    });
});
