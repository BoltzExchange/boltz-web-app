import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import log from "loglevel";
import { vi } from "vitest";

import { BackupDone } from "../../src/components/CreateButton";
import BackupVerify from "../../src/pages/BackupVerify";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

const navigate = vi.fn();

const testRescueFile = {
    mnemonic:
        "horse olympic laundry marriage material private arch civil theory crew alone thank",
};

const invalidRescueFile = {
    mnemonic: "invalid mnemonic",
};

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual("@solidjs/router");
    return {
        ...actual,
        useParams: vi.fn(() => ({})),
        useNavigate: () => navigate,
    };
});

describe("BackupVerify", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        log.disableAll();
    });

    test("should verify rescue file", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerify />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        // Set the rescue file in context to match the one we'll upload
        globalSignals.setRescueFile(testRescueFile);

        const fileInput = screen.getByTestId("rescueFileUpload");

        File.prototype.text = vi
            .fn()
            .mockResolvedValue(JSON.stringify(testRescueFile));

        await user.upload(
            fileInput,
            new File([], "rescueFile.json", {
                type: "application/json",
            }),
        );

        await waitFor(() => {
            expect(navigate).toHaveBeenCalledWith("/swap", {
                state: {
                    backupDone: BackupDone.True,
                },
            });
        });
    });

    test("should not verify invalid rescue file", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerify />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const fileInput = screen.getByTestId("rescueFileUpload");

        File.prototype.text = vi
            .fn()
            .mockResolvedValue(JSON.stringify(invalidRescueFile));

        await user.upload(
            fileInput,
            new File([], "rescueFile.json", {
                type: "application/json",
            }),
        );

        await waitFor(() => {
            expect(navigate).not.toHaveBeenCalled();
        });
    });

    test("should not verify rescue file that does not match current one", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerify />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        globalSignals.setRescueFile({
            mnemonic:
                "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        });

        const fileInput = screen.getByTestId("rescueFileUpload");

        File.prototype.text = vi
            .fn()
            .mockResolvedValue(JSON.stringify(testRescueFile));

        await user.upload(
            fileInput,
            new File([], "rescueFile.json", {
                type: "application/json",
            }),
        );

        await waitFor(() => {
            expect(navigate).not.toHaveBeenCalled();
        });
    });
});
