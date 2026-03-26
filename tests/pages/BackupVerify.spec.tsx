import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import log from "loglevel";
import { vi } from "vitest";

import BackupVerifyContent from "../../src/components/BackupVerifyContent";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

const onRetry = vi.fn();

const testRescueFile = {
    mnemonic:
        "horse olympic laundry marriage material private arch civil theory crew alone thank",
};

const invalidRescueFile = {
    mnemonic: "invalid mnemonic",
};

describe("BackupVerifyContent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        log.disableAll();
        localStorage.clear();
    });

    test("should verify rescue file", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerifyContent onRetry={onRetry} />
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
            expect(globalSignals.rescueFileBackupDone()).toBe(true);
        });
    });

    test("should not verify invalid rescue file", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerifyContent onRetry={onRetry} />
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
            expect(globalSignals.rescueFileBackupDone()).toBe(false);
        });
    });

    test("should not verify rescue file that does not match current one", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerifyContent onRetry={onRetry} />
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
            expect(globalSignals.rescueFileBackupDone()).toBe(false);
        });
    });

    test("should invoke retry callback when verification fails", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerifyContent onRetry={onRetry} />
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

        await user.click(await screen.findByRole("button"));

        expect(onRetry).toHaveBeenCalled();
    });
});
