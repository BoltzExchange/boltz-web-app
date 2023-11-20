import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";

import ContractTransaction from "../../src/components/ContractTransaction";
import LoadingSpinner from "../../src/components/LoadingSpinner";

describe("ContractTransaction", () => {
    test("should show button in starting state", async () => {
        const buttonText = "button";
        const { container } = render(() => (
            <ContractTransaction
                onClick={async () => {}}
                buttonText={buttonText}
            />
        ));

        const button = await screen.findByText(buttonText);
        expect(button).not.toBeUndefined();

        expect(container.childNodes.length).toEqual(1);
        expect(container.childNodes[0]).toEqual(button);
    });

    test("should prompt text above button in starting state", async () => {
        const promptText = "pls send";
        const buttonText = "button";

        const { container } = render(() => (
            <ContractTransaction
                onClick={async () => {}}
                promptText={promptText}
                buttonText={buttonText}
            />
        ));

        expect(container.childNodes.length).toEqual(2);
        expect(container.childNodes[0].textContent).toEqual(promptText);
        expect(container.childNodes[1].textContent).toEqual(buttonText);
    });

    test("should show hr in starting state", async () => {
        const promptText = "pls send";
        const buttonText = "button";

        const { container } = render(() => (
            <ContractTransaction
                onClick={async () => {}}
                showHr={true}
                promptText={promptText}
                buttonText={buttonText}
            />
        ));

        expect(container.childNodes.length).toEqual(3);
        expect(container.childNodes[0].textContent).toEqual(promptText);
        expect(container.childNodes[1].textContent).toEqual(buttonText);
        expect(container.childNodes[2].nodeName).toEqual("HR");
    });

    test("should show loading spinner after tx has been sent", async () => {
        const onClick = vi.fn().mockResolvedValue(undefined);
        const buttonText = "button";

        const { container } = render(() => (
            <ContractTransaction onClick={onClick} buttonText={buttonText} />
        ));

        fireEvent.click(await screen.findByText(buttonText));
        expect(onClick).toHaveBeenCalled();

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(container.childNodes.length).toEqual(2);
        expect(container.childNodes[0]).toEqual(
            render(() => <LoadingSpinner />).container.childNodes[0],
        );
        expect(container.childNodes[1].nodeName).toEqual("HR");
    });

    test("should show waiting text above loading spinner after tx has been sent", async () => {
        const onClick = vi.fn().mockResolvedValue(undefined);
        const buttonText = "button";
        const waitingText = "waiting";

        const { container } = render(() => (
            <ContractTransaction
                onClick={onClick}
                buttonText={buttonText}
                waitingText={waitingText}
            />
        ));

        fireEvent.click(await screen.findByText(buttonText));

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(container.childNodes.length).toEqual(3);
        expect(container.childNodes[0].textContent).toEqual(waitingText);
    });
});
