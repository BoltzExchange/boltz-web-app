import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { fireEvent, render, screen, within } from "@solidjs/testing-library";

import MnemonicVerifyContent from "../../src/components/MnemonicVerifyContent";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

const onIncorrect = vi.fn();
const TEST_RUNS = 500;

const getButtonTexts = async () => {
    const buttonsContainer = await screen.findByTestId("verification-buttons");

    const buttons = within(buttonsContainer).getAllByRole("button");

    const buttonTexts = buttons.map(
        (button) => button.textContent?.trim() ?? "",
    );

    expect(buttonTexts.length).toEqual(4);
    expect(new Set(buttonTexts).size).toEqual(4);

    return buttonTexts;
};

describe("MnemonicVerifyContent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    for (let run = 1; run <= TEST_RUNS; run++) {
        describe(`run ${run}`, () => {
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

                const mnemonicItems = await within(
                    verificationWords,
                ).findAllByText(/order|chief|rival|tourist/);

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

            it("should not pick a fake button that matches any word in the displayed group", async () => {
                const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
                try {
                    render(
                        () => (
                            <>
                                <TestComponent />
                                <MnemonicVerifyContent
                                    onIncorrect={onIncorrect}
                                />
                            </>
                        ),
                        { wrapper: contextWrapper },
                    );
                    const mnemonic =
                        "abandon ability able about above absent absorb abstract absurd abuse access accident";
                    globalSignals.setRescueFile({ mnemonic });

                    const buttonTexts = await getButtonTexts();
                    const groupWords = mnemonic.split(" ").slice(0, 4);

                    expect(buttonTexts[0]).toBe("abandon");
                    for (let i = 1; i < buttonTexts.length; i++) {
                        expect(groupWords).not.toContain(buttonTexts[i]);
                    }
                } finally {
                    randomSpy.mockRestore();
                }
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
                    const buttonsContainer = await screen.findByTestId(
                        "verification-buttons",
                    );
                    const correctButtonElement = within(
                        buttonsContainer,
                    ).getByRole("button", { name: correctButton });
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

                const buttonsContainer = await screen.findByTestId(
                    "verification-buttons",
                );
                const incorrectButtonElement = within(
                    buttonsContainer,
                ).getByRole("button", { name: incorrectButton });

                fireEvent.click(incorrectButtonElement);

                expect(onIncorrect).toHaveBeenCalled();
            });
        });
    }
});
