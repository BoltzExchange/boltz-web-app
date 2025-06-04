import { fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import CopyButton from "../../src/components/CopyButton";
import i18n from "../../src/i18n/i18n";
import { contextWrapper } from "../helper";

/* eslint-disable @typescript-eslint/unbound-method */

const writeText = vi.fn();

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

        const btn = button as HTMLSpanElement;

        expect(btn).not.toBeUndefined();
        expect(btn.textContent).toEqual(i18n.en.copy_bip21);
        fireEvent.click(btn);
        expect(btn.classList.contains("btn-active")).toBeTruthy();
        await new Promise((resolve) => setTimeout(resolve, 700));
        expect(btn.classList.contains("btn-active")).toBeFalsy();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
    });

    test("should not copy spaces", () => {
        const textToCopy = "50 000";
        const expectedCopy = "50000";

        const {
            container: { firstChild: button },
        } = render(() => <CopyButton label="copy_bip21" data={textToCopy} />, {
            wrapper: contextWrapper,
        });

        const btn = button as HTMLSpanElement;
        fireEvent.click(btn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            expectedCopy,
        );
    });

    test("should copy spaces", () => {
        const textToCopy =
            "main little unit rookie path embody ancient repair message dirt brush task";

        const {
            container: { firstChild: button },
        } = render(
            () => (
                <CopyButton
                    label="copy_bip21"
                    data={textToCopy}
                    removeSpaces={false}
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const btn = button as HTMLSpanElement;
        fireEvent.click(btn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
    });

    test("should copy from a function", () => {
        const textToCopy = "50000";
        const [signal] = createSignal(textToCopy);

        const {
            container: { firstChild: button },
        } = render(() => <CopyButton label="copy_bip21" data={signal} />, {
            wrapper: contextWrapper,
        });

        const btn = button as HTMLSpanElement;
        fireEvent.click(btn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
    });
});
