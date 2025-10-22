import { fireEvent, render, screen } from "@solidjs/testing-library";

import CopyBox from "../../src/components/CopyBox";
import { contextWrapper } from "../helper";

/* eslint-disable @typescript-eslint/unbound-method */

const writeText = vi.fn();

Object.defineProperty(navigator, "clipboard", {
    value: {
        writeText,
    },
});

describe("CopyBox", () => {
    beforeEach(() => {
        writeText.mockClear();
    });

    test("should stay active for 600ms and copy into clipboard", async () => {
        const address = "bcrt1qhgpdl988atca59fv2hgh87kcs9td082aucra3d";

        const {
            container: { firstChild },
        } = render(() => <CopyBox value={address} />, {
            wrapper: contextWrapper,
        });

        const copyBox = firstChild as HTMLParagraphElement;

        expect(copyBox).not.toBeUndefined();
        expect(screen.getByTestId("copy-icon")).toBeTruthy();

        fireEvent.click(copyBox);

        expect(screen.getByTestId("checkmark-icon")).toBeTruthy();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);

        // should still show checkmark
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(screen.getByTestId("checkmark-icon")).toBeTruthy();

        // should show copy icon again
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(screen.getByTestId("copy-icon")).toBeTruthy();
    });

    test("should format address in groups of 5 characters", () => {
        const address = "bcrt1qrhg8z3ccu8vmnz7xvwx8t92mykw6ru64k96e4v";
        const expectedFormatted =
            "bcrt1 qrhg8 z3ccu 8vmnz 7xvwx 8t92m ykw6r u64k9 6e4v";

        const {
            container: { firstChild },
        } = render(() => <CopyBox value={address} />, {
            wrapper: contextWrapper,
        });

        const copyBox = firstChild as HTMLParagraphElement;

        expect(copyBox.textContent).toContain(expectedFormatted);
    });

    test("should copy unformatted address to clipboard", () => {
        const address = "bcrt1qrhg8z3ccu8vmnz7xvwx8t92mykw6ru64k96e4v";

        const {
            container: { firstChild },
        } = render(() => <CopyBox value={address} />, {
            wrapper: contextWrapper,
        });

        const copyBox = firstChild as HTMLParagraphElement;

        fireEvent.click(copyBox);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);
    });
});
