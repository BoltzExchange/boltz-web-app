import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";

import { legacyRescueRedirects } from "../../src/components/LegacyRescueRedirects";

const renderAt = (path: string) => {
    const history = createMemoryHistory();
    history.set({ value: path });

    render(() => (
        <MemoryRouter history={history}>
            <Route
                path="/rescue"
                component={() => <div data-testid="rescue-page" />}
            />
            {legacyRescueRedirects()}
        </MemoryRouter>
    ));

    return history;
};

describe("legacyRescueRedirects", () => {
    test.each([
        ["/refund", "/rescue"],
        ["/refund?mode=rescue-key", "/rescue?mode=rescue-key"],
        ["/refund/external", "/rescue"],
        ["/refund/external?mode=rescue-key", "/rescue?mode=rescue-key"],
        ["/refund/external/btc", "/rescue"],
        ["/refund/external/btc/claim", "/rescue"],
        ["/rescue/external", "/rescue"],
        ["/rescue/external?mode=rescue-key", "/rescue?mode=rescue-key"],
        ["/rescue/external/rsk?mode=rescue-key", "/rescue?mode=rescue-key"],
        ["/rescue/external/rsk/claim", "/rescue"],
    ])("should redirect %s to %s", async (from, to) => {
        const history = renderAt(from);

        expect(await screen.findByTestId("rescue-page")).toBeInTheDocument();
        await waitFor(() => {
            expect(history.get()).toBe(to);
        });
    });
});
