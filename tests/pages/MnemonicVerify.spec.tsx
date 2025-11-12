import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { fireEvent, render, screen, within } from "@solidjs/testing-library";

import { BackupDone } from "../../src/components/CreateButton";
import MnemonicVerify from "../../src/pages/MnemonicVerify";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

const navigate = vi.fn();

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual("@solidjs/router");
    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

const getButtonTexts = async () => {
    const buttonsContainer = await screen.findByTestId("verification-buttons");

    const buttons = within(buttonsContainer).getAllByRole("button");

    const buttonTexts = buttons.map((button) => button.textContent?.trim());

    expect(buttonTexts.length).toEqual(4);

    return buttonTexts;
};

describe("MnemonicVerify", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should hide 1 out of 4 words", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicVerify />
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
                    <MnemonicVerify />
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

    it("should invoke `backupDone` when all words are correct", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicVerify />
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

        expect(navigate).toHaveBeenCalledWith("/swap", {
            state: { backupDone: BackupDone.True },
        });
    });

    it("should navigate to backup page when incorrect word is clicked", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <MnemonicVerify />
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

        expect(navigate).toHaveBeenCalledWith("/backup/mnemonic");
    });
});
