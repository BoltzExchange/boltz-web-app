import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { fireEvent, render, screen, within } from "@solidjs/testing-library";

import MnemonicVerifyContent from "../../src/components/MnemonicVerifyContent";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

const onIncorrect = vi.fn();

const getButtonTexts = async () => {
    const buttonsContainer = await screen.findByTestId("verification-buttons");

    const buttons = within(buttonsContainer).getAllByRole("button");

    const buttonTexts = buttons.map((button) => button.textContent?.trim());

    expect(buttonTexts.length).toEqual(4);

    return buttonTexts;
};

describe("MnemonicVerifyContent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("should hide 1 out of 4 words", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicVerifyContent onIncorrect={onIncorrect} />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setRescueFile({
            mnemonic:
                "order chief rival tourist trick blur zero dish absorb page bulk rib",
        });

        const verificationWords =
            await screen.findByTestId("verification-words");

        const mnemonicItems = await within(verificationWords).findAllByText(
            /order|chief|rival|tourist/,
        );

        expect(mnemonicItems.length).toEqual(3);
    });

    it("should display 1 verification word and 3 fake words", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicVerifyContent onIncorrect={onIncorrect} />
                </>
            ),
            { wrapper: contextWrapper },
        );
        const mnemonic = generateMnemonic(wordlist);
        globalSignals.setRescueFile({
            mnemonic,
        });

        const buttonTexts = await getButtonTexts();

        const correctButtonText = buttonTexts.filter((buttonText) =>
            mnemonic.split(" ").slice(0, 4).includes(buttonText),
        );
        const incorrectButtonTexts = buttonTexts.filter(
            (buttonText) =>
                !mnemonic.split(" ").slice(0, 4).includes(buttonText),
        );

        expect(correctButtonText.length).toEqual(1);
        expect(incorrectButtonTexts.length).toEqual(3);
    });

    it("should set rescueFileBackupDone when all words are correct", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicVerifyContent onIncorrect={onIncorrect} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const mnemonic = generateMnemonic(wordlist);
        globalSignals.setRescueFile({
            mnemonic,
        });

        for (let i = 0; i < 3; i++) {
            const buttonTexts = await getButtonTexts();
            const correctButton = buttonTexts.find((buttonText) =>
                mnemonic
                    .split(" ")
                    .slice(i * 4, (i + 1) * 4)
                    .includes(buttonText),
            );
            const correctButtonElement = await screen.findByText(correctButton);
            fireEvent.click(correctButtonElement);
        }

        expect(globalSignals.rescueFileBackupDone()).toBe(true);
    });

    it("should invoke incorrect callback when incorrect word is clicked", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicVerifyContent onIncorrect={onIncorrect} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const mnemonic = generateMnemonic(wordlist);
        globalSignals.setRescueFile({
            mnemonic,
        });

        const buttonTexts = await getButtonTexts();

        const incorrectButton = buttonTexts.find(
            (buttonText) => !mnemonic.split(" ").includes(buttonText),
        );

        const incorrectButtonElement = screen.getByText(incorrectButton);

        fireEvent.click(incorrectButtonElement);

        expect(onIncorrect).toHaveBeenCalled();
    });
});
