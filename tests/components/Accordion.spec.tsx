import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";

import Accordion from "../../src/components/Accordion";

const accordionTitle = "Accordion Title";
const accordionContent = "Accordion Content";

describe("Accordion", () => {
    it("should show content when open", () => {
        render(() => (
            <Accordion title={accordionTitle} isOpen={true}>
                {accordionContent}
            </Accordion>
        ));
        expect(screen.queryByText(accordionContent)).toBeInTheDocument();
    });

    it("should hide content when closed", () => {
        render(() => (
            <Accordion title={accordionTitle} isOpen={false}>
                {accordionContent}
            </Accordion>
        ));
        expect(screen.queryByText(accordionContent)).toBeNull();
    });

    it("should call onClick when header is clicked", () => {
        const onClick = vi.fn();
        render(() => (
            <Accordion title={accordionTitle} isOpen={false} onClick={onClick}>
                {accordionContent}
            </Accordion>
        ));
        const button = screen.getByRole("button");
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
