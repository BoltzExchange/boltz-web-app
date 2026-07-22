import type * as SolidRouter from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import dict from "../../src/i18n/i18n";
import ClaimRescue from "../../src/pages/ClaimRescue";
import { TestComponent, contextWrapper } from "../helper";

const swapId = "claimRescueSwap";

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual<typeof SolidRouter>("@solidjs/router");
    return {
        ...actual,
        useParams: () => ({ id: swapId }),
    };
});

describe("ClaimRescue", () => {
    test("renders the error UI without crashing when the swap cannot be constructed", async () => {
        // No rescue file in the default context, so the fetcher throws
        render(
            () => (
                <>
                    <TestComponent />
                    <ClaimRescue />
                </>
            ),
            { wrapper: contextWrapper },
        );

        await waitFor(() => {
            expect(
                screen.getByText(
                    dict.en.failed_get_swap.replace("{{ id }}", swapId),
                ),
            ).toBeInTheDocument();
        });
        expect(screen.getByText(dict.en.error)).toBeInTheDocument();

        // Reading an errored resource rethrows; the binding must be state-guarded
        expect(document.querySelector(".frame")).not.toHaveAttribute(
            "data-status",
        );
    });
});
