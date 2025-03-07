import { render, screen } from "@solidjs/testing-library";

import Logs from "../../src/components/settings/Logs";
import { contextWrapper } from "../helper";

let mockIsIos = false;

vi.mock("../../src/utils/helper", () => ({
    isIos: () => mockIsIos,
    isMobile: () => false,
}));

describe("Logs", () => {
    beforeEach(() => {
        mockIsIos = false;
    });

    test("should not show download on iOS", async () => {
        mockIsIos = true;

        render(() => <Logs />, {
            wrapper: contextWrapper,
        });

        await expect(screen.findByTestId("logs-download")).rejects.toEqual(
            expect.anything(),
        );
    });

    test("should show download platforms that are not iOS", async () => {
        mockIsIos = false;

        render(() => <Logs />, {
            wrapper: contextWrapper,
        });

        await screen.findByTestId("logs-download");
    });
});
