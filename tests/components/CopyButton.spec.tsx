import { fireEvent, render } from "@solidjs/testing-library";

import CopyButton from "../../src/components/CopyButton";
import i18n from "../../src/i18n/i18n";
import { contextWrapper } from "../helper";

const writeText = jest.fn();

Object.defineProperty(navigator, "clipboard", {
    value: {
        writeText,
    },
});

describe("CopyButton", () => {
    test("should stay active for 1 second and copy into clipboard", async () => {
        const textToCopy = "clipboard";

        const {
            container: { firstChild: button },
        } = render(() => <CopyButton label="copy_bip21" data={textToCopy} />, {
            wrapper: contextWrapper,
        });

        let btn = button as HTMLSpanElement;

        expect(btn).not.toBeUndefined();
        expect(btn.textContent).toEqual(i18n.en.copy_bip21);
        fireEvent.click(btn);
        expect(btn.classList.contains("btn-active")).toBeTruthy();
        await new Promise((resolve) => setTimeout(resolve, 700));
        expect(btn.classList.contains("btn-active")).toBeFalsy();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
    });
    test("dont copy spaces", async () => {
        const textToCopy = "50 000";
        const expectedCopy = "50000";

        const {
            container: { firstChild: button },
        } = render(() => <CopyButton label="copy_bip21" data={textToCopy} />, {
            wrapper: contextWrapper,
        });

        let btn = button as HTMLSpanElement;
        fireEvent.click(btn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            expectedCopy,
        );
    });
});
