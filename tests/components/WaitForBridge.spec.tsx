import { render, screen, waitFor } from "@solidjs/testing-library";

import WaitForBridge from "../../src/components/WaitForBridge";
import { BridgeKind } from "../../src/configs/base";
import { SwapPosition } from "../../src/consts/Enums";
import { waitForOftTransactionConfirmationTimestamp } from "../../src/utils/oft/oft";

const mockTranslations = vi.hoisted(() => ({
    waiting_for_oft: "Waiting for OFT",
    oft_eta: "Estimated arrival in about {{ time }}",
    oft_eta_day_unit: "{{ value }}d",
    oft_eta_hour_unit: "{{ value }}h",
    oft_eta_minute_unit: "{{ value }}m",
    oft_eta_second_unit: "{{ value }}s",
    oft_arriving_soon: "Arriving soon...",
    oft_transfer_in_progress: "Transfer in progress",
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            let text =
                mockTranslations[key as keyof typeof mockTranslations] ?? key;

            for (const [name, value] of Object.entries(params ?? {})) {
                text = text.replace(`{{ ${name} }}`, String(value));
            }

            return text;
        },
    }),
}));

vi.mock("../../src/utils/oft/oft", () => ({
    waitForOftTransactionConfirmationTimestamp: vi.fn(),
}));

describe("WaitForBridge", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-27T15:00:00Z"));
        vi.mocked(waitForOftTransactionConfirmationTimestamp).mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("waits for OFT transaction confirmation before starting the ETA", async () => {
        let confirmTransaction: ((timestamp: number) => void) | undefined;
        vi.mocked(
            waitForOftTransactionConfirmationTimestamp,
        ).mockImplementation(
            () =>
                new Promise((resolve) => {
                    confirmTransaction = resolve;
                }),
        );

        render(() => (
            <WaitForBridge
                bridge={{
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Pre,
                    sourceAsset: "USDT0-ETH",
                    destinationAsset: "USDT0",
                }}
                transactionHash="tx-hash"
            />
        ));

        await waitFor(() =>
            expect(
                waitForOftTransactionConfirmationTimestamp,
            ).toHaveBeenCalledTimes(1),
        );
        expect(
            screen.getByText(mockTranslations.oft_transfer_in_progress),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/Estimated arrival/u),
        ).not.toBeInTheDocument();

        confirmTransaction?.(Date.now() / 1_000);
        await Promise.resolve();

        await screen.findByText(/Estimated arrival/u);
        expect(
            vi.mocked(waitForOftTransactionConfirmationTimestamp),
        ).toHaveBeenCalledTimes(1);
    });
});
