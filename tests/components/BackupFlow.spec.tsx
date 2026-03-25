import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import BackupFlow, { BackupStep } from "../../src/components/BackupFlow";
import i18n from "../../src/i18n/i18n";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

describe("BackupFlow", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    test("should reset its internal step when resetKey changes", async () => {
        let setResetKey: (value: string) => void = () => undefined;

        const Wrapper = () => {
            const [resetKey, updateResetKey] = createSignal("swap-1");
            setResetKey = updateResetKey;

            return (
                <>
                    <TestComponent />
                    <BackupFlow
                        initialStep={BackupStep.Mnemonic}
                        resetKey={resetKey()}
                    />
                </>
            );
        };

        render(() => <Wrapper />, {
            wrapper: contextWrapper,
        });

        globalSignals.setRescueFile({
            mnemonic:
                "order chief rival tourist trick blur zero dish absorb page bulk rib",
        });

        fireEvent.click(
            await screen.findByRole("button", {
                name: i18n.en.user_saved_key,
            }),
        );

        await screen.findByTestId("verification-buttons");

        setResetKey("swap-2");

        await waitFor(() => {
            expect(screen.queryByTestId("verification-buttons")).toBeNull();
            expect(
                screen.getByRole("button", {
                    name: i18n.en.user_saved_key,
                }),
            ).not.toBeNull();
        });
    });
});
