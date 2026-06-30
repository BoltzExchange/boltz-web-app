import { render, screen, waitFor } from "@solidjs/testing-library";
import { createEffect, createSignal } from "solid-js";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SomeSwap } from "../../src/utils/swapCreator";

const [swap, setSwapSignal] = createSignal<SomeSwap | null>(null, {
    equals: false,
});
const refundButton = vi.fn<(swap: SomeSwap | null) => void>();

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        swap,
    }),
}));

vi.mock("../../src/components/RefundButton", () => ({
    default: (props: { swap: () => SomeSwap | null }) => {
        createEffect(() => refundButton(props.swap()));
        return <div data-testid="refund-button" />;
    },
}));

const { default: CommitmentRejected } =
    await import("../../src/status/CommitmentRejected");

const makeSwap = (): SomeSwap =>
    ({
        id: "swap-1",
        assetSend: "TBTC",
        commitmentRejection: { reason: "insufficient amount: 16643 < 16650" },
    }) as SomeSwap;

describe("CommitmentRejected", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setSwapSignal(makeSwap());
    });

    test("renders the explanation and the reused RefundButton", () => {
        render(() => <CommitmentRejected />);

        expect(screen.getByText("commitment_rejected_line")).toBeTruthy();
        expect(screen.getByTestId("refund-button")).toBeTruthy();
    });

    test("hands the rejected swap to RefundButton", async () => {
        render(() => <CommitmentRejected />);

        await waitFor(() =>
            expect(refundButton).toHaveBeenCalledWith(
                expect.objectContaining({ id: "swap-1" }),
            ),
        );
    });
});
