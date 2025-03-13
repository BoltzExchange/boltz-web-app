import { render, screen } from "@solidjs/testing-library";

import Logs from "../../src/components/settings/Logs";
import { contextWrapper } from "../helper";

describe("Logs", () => {
    test("should show download on all platforms", async () => {
        render(() => <Logs />, {
            wrapper: contextWrapper,
        });

        await screen.findByTestId("logs-download");
    });
});
