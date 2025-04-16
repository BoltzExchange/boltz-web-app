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
});
