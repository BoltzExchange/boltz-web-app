import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import Pagination from "../../src/components/Pagination";
import { BTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import type { SubmarineSwap } from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper } from "../helper";

const lockupAddress = "2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp";
const [swaps] = createSignal<SubmarineSwap[]>([
    {
        version: 1,
        date: 1620000000,
        id: "swap",
        assetSend: BTC,
        assetReceive: BTC,
        sendAmount: 10000,
        receiveAmount: 10000,
        type: SwapType.Submarine,
        address: lockupAddress,
        bip21: `bitcoin:${lockupAddress}?amount=0.0001`,
        swapTree: {},
    },
] as SubmarineSwap[]);

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual("@solidjs/router");
    return {
        ...actual,
        useSearchParams: () => [{ page: "1" }, vi.fn()],
    };
});

describe("Pagination", () => {
    test("should change page on button click", async () => {
        const [currentPage, setCurrentPage] = createSignal(1);
        render(
            () => (
                <>
                    <TestComponent />
                    <Pagination
                        items={swaps}
                        setDisplayedItems={() => null}
                        totalItems={30}
                        itemsPerPage={5}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const previousButton = (await screen.findByTestId(
            "previous-page",
        )) as HTMLButtonElement;
        const page1 = (await screen.findByTestId("page-1")) as HTMLDivElement;
        const page2 = (await screen.findByTestId("page-2")) as HTMLDivElement;
        const nextButton = (await screen.findByTestId(
            "next-page",
        )) as HTMLButtonElement;

        expect(page1.classList.contains("active")).toBeTruthy();
        expect(page2.classList.contains("active")).toBeFalsy();

        // Click on page 2
        fireEvent.click(page2);
        expect(page1.classList.contains("active")).toBeFalsy();
        expect(page2.classList.contains("active")).toBeTruthy();

        // Click on previous button
        fireEvent.click(previousButton);
        expect(page1.classList.contains("active")).toBeTruthy();
        expect(page2.classList.contains("active")).toBeFalsy();

        // Click on next button
        fireEvent.click(nextButton);
        expect(page1.classList.contains("active")).toBeFalsy();
        expect(page2.classList.contains("active")).toBeTruthy();
    });

    test("should disable previous and next buttons when on first and last page", async () => {
        const [currentPage, setCurrentPage] = createSignal(1);
        render(
            () => (
                <>
                    <TestComponent />
                    <Pagination
                        items={swaps}
                        setDisplayedItems={() => null}
                        totalItems={25}
                        itemsPerPage={5}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const previousButton = (await screen.findByTestId(
            "previous-page",
        )) as HTMLButtonElement;
        const page1 = (await screen.findByTestId("page-1")) as HTMLDivElement;
        const page5 = (await screen.findByTestId("page-5")) as HTMLDivElement;
        const nextButton = (await screen.findByTestId(
            "next-page",
        )) as HTMLButtonElement;

        // Check if previous button is disabled and page 1 is active
        expect(previousButton.disabled).toBeTruthy();
        expect(page1.classList.contains("active")).toBeTruthy();

        // Check if next button is not disabled
        expect(nextButton.disabled).toBeFalsy();

        // Click on page 5
        fireEvent.click(page5);
        expect(nextButton.disabled).toBeTruthy();

        // Check if previous button is not disabled
        expect(previousButton.disabled).toBeFalsy();
    });
});
