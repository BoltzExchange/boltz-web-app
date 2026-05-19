import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import Logs from "../../src/components/settings/Logs";
import { contextWrapper } from "../helper";

const { chatwootConfiguredMock, postLogsToChatwootMock } = vi.hoisted(() => ({
    chatwootConfiguredMock: vi.fn(() => false),
    postLogsToChatwootMock: vi.fn(),
}));

vi.mock("../../src/utils/chatwoot", () => ({
    isChatwootConfigured: chatwootConfiguredMock,
    postLogsToChatwoot: postLogsToChatwootMock,
}));

describe("Logs", () => {
    beforeEach(() => {
        chatwootConfiguredMock.mockReturnValue(false);
        postLogsToChatwootMock.mockReset();
    });

    test("should show download on all platforms", async () => {
        render(() => <Logs />, {
            wrapper: contextWrapper,
        });

        await screen.findByTestId("logs-download");
    });

    test("should show copy when Chatwoot is not configured", async () => {
        render(() => <Logs />, {
            wrapper: contextWrapper,
        });

        await screen.findByTestId("logs-copy");
        expect(screen.queryByTestId("logs-chatwoot")).toBeNull();
    });

    test("should post logs to Chatwoot instead of showing copy when configured", async () => {
        chatwootConfiguredMock.mockReturnValue(true);
        postLogsToChatwootMock.mockResolvedValue(undefined);

        render(() => <Logs />, {
            wrapper: contextWrapper,
        });

        expect(screen.queryByTestId("logs-copy")).toBeNull();
        fireEvent.click(await screen.findByTestId("logs-chatwoot"));

        await waitFor(() => {
            expect(postLogsToChatwootMock).toHaveBeenCalledOnce();
        });
    });
});
