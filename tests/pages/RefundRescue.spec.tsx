import type * as SolidRouter from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";
import type { RestorableSwap } from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";
import type { JSX } from "solid-js";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { BTC, LBTC, RBTC, TBTC } from "../../src/consts/Assets";
import type * as RescueContextModule from "../../src/context/Rescue";
import dict from "../../src/i18n/i18n";
import RefundRescue, { mapSwap } from "../../src/pages/RefundRescue";
import type { RescueFile } from "../../src/utils/rescueFile";
import type { ChainSwap } from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper, payContext } from "../helper";

const {
    mockGetCurrentBlockHeight,
    mockGetSwapStatus,
    mockGetRescuableUTXOs,
    restorableSwaps,
    waitForSwapTimeoutState,
    pageSwapId,
    lockupTxId,
} = vi.hoisted(() => ({
    mockGetCurrentBlockHeight: vi.fn(),
    mockGetSwapStatus: vi.fn(),
    mockGetRescuableUTXOs: vi.fn(),
    restorableSwaps: { current: [] as RestorableSwap[] },
    waitForSwapTimeoutState: { current: false },
    pageSwapId: "refundRescuePage",
    lockupTxId:
        "813c90372c9b774396c66099cf8015f9510a8ba5686cbb78d8e848959fe7bb5d",
}));

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual<typeof SolidRouter>("@solidjs/router");
    return {
        ...actual,
        useParams: () => ({ id: pageSwapId }),
        useLocation: () => ({
            state: waitForSwapTimeoutState.current
                ? { waitForSwapTimeout: true }
                : undefined,
        }),
    };
});

vi.mock("boltz-swaps/client", async () => {
    const actual = await vi.importActual("boltz-swaps/client");
    return {
        ...actual,
        getSwapStatus: mockGetSwapStatus,
    };
});

vi.mock("../../src/utils/rescue", async () => {
    const actual = await vi.importActual("../../src/utils/rescue");
    return {
        ...actual,
        getCurrentBlockHeight: mockGetCurrentBlockHeight,
        getRescuableUTXOs: mockGetRescuableUTXOs,
    };
});

vi.mock("../../src/context/Rescue", async () => {
    const actual = await vi.importActual<typeof RescueContextModule>(
        "../../src/context/Rescue",
    );
    // Signal-backed so writes after render are reactive
    const { createSignal } = await import("solid-js");
    const [swaps, setSwaps] = createSignal<RestorableSwap[]>(
        restorableSwaps.current,
    );
    Object.defineProperty(restorableSwaps, "current", {
        get: () => swaps(),
        set: setSwaps,
    });
    return {
        ...actual,
        RescueProvider: (props: { children: JSX.Element }) => (
            <>{props.children}</>
        ),
        useRescueContext: () => ({
            rescuableSwaps: () => restorableSwaps.current,
            rescueFile: () => ({ mnemonic: "test" }) as RescueFile,
        }),
    };
});

const tree = {
    claimLeaf: { output: "claim", version: 0xc0 },
    refundLeaf: { output: "refund", version: 0xc0 },
};

const baseDetails = {
    tree,
    keyIndex: 7,
    lockupAddress: "tb1qlockup",
    serverPublicKey: "02aabbcc",
    timeoutBlockHeight: 123_456,
};

const baseSwap = {
    id: "swap-id",
    status: "pending",
    createdAt: 1700000000,
};

const failedRestorable: RestorableSwap = {
    ...baseSwap,
    id: pageSwapId,
    status: "transaction.lockupFailed",
    type: SwapType.Submarine,
    from: BTC,
    to: LBTC,
    refundDetails: {
        ...baseDetails,
        transaction: { id: lockupTxId, vout: 0 },
    },
};

const openLockupTxLabel = dict.en.blockexplorer.replace(
    "{{ typeLabel }}",
    dict.en.blockexplorer_lockup_tx,
);
const openLockupAddressLabel = dict.en.blockexplorer.replace(
    "{{ typeLabel }}",
    dict.en.blockexplorer_lockup_address,
);

describe("mapSwap", () => {
    test("returns undefined for missing swap", () => {
        expect(mapSwap(undefined)).toBeUndefined();
    });

    test("returns undefined when refundDetails are missing for submarine", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Submarine,
            from: BTC,
            to: BTC,
        };
        expect(mapSwap(swap)).toBeUndefined();
    });

    test("returns undefined when claimDetails are missing for reverse", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Reverse,
            from: BTC,
            to: BTC,
        };
        expect(mapSwap(swap)).toBeUndefined();
    });

    test("submarine output preserves the legacy keys downstream relies on", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Submarine,
            from: BTC,
            to: LBTC,
            refundDetails: { ...baseDetails, blindingKey: "deadbeef" },
        };

        const mapped = mapSwap(swap);
        expect(mapped).toMatchObject({
            type: SwapType.Submarine,
            assetSend: BTC,
            assetReceive: LBTC,
            version: OutputType.Taproot,
            address: baseDetails.lockupAddress,
            blindingKey: "deadbeef",
            swapTree: tree,
            refundPrivateKeyIndex: baseDetails.keyIndex,
            claimPublicKey: baseDetails.serverPublicKey,
            timeoutBlockHeight: baseDetails.timeoutBlockHeight,
        });
    });

    test("reverse output renames address to lockupAddress and exposes claim metadata", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Reverse,
            from: BTC,
            to: BTC,
            claimDetails: { ...baseDetails, amount: 4242 },
        };

        const mapped = mapSwap(swap);
        expect(mapped).toMatchObject({
            type: SwapType.Reverse,
            assetSend: BTC,
            assetReceive: BTC,
            version: OutputType.Taproot,
            lockupAddress: baseDetails.lockupAddress,
            timeoutBlockHeight: baseDetails.timeoutBlockHeight,
            claimPrivateKeyIndex: baseDetails.keyIndex,
            sendAmount: 4242,
        });
        // The legacy "address" key is gone — reverse swaps now expose lockupAddress.
        expect(mapped).not.toHaveProperty("address");
    });

    test("chain output collapses refund details into lockupDetails and drops legacy duplicates", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Chain,
            from: RBTC,
            to: BTC,
            claimDetails: { ...baseDetails, keyIndex: 11 },
            refundDetails: { ...baseDetails, keyIndex: 9 },
        };

        const mapped = mapSwap(swap);
        expect(mapped).toMatchObject({
            type: SwapType.Chain,
            assetSend: RBTC,
            assetReceive: BTC,
            version: OutputType.Taproot,
            refundPrivateKeyIndex: 9,
            claimPrivateKeyIndex: 11,
            lockupDetails: {
                ...baseDetails,
                keyIndex: 9,
                swapTree: tree,
            },
        });

        // Top-level legacy duplicates must be dropped — readers go through
        // lockupDetails.* instead. If these come back, downstream logic that
        // narrows on swap shape will silently pick the wrong source of truth.
        expect(mapped).not.toHaveProperty("address");
        expect(mapped).not.toHaveProperty("claimPublicKey");
        expect(mapped).not.toHaveProperty("timeoutBlockHeight");
        expect(mapped).not.toHaveProperty("claimDetails");
        expect(mapped).not.toHaveProperty("refundDetails");
    });

    test("maps an EVM-source chain swap without UTXO refund details", () => {
        const swap: RestorableSwap = {
            ...baseSwap,
            type: SwapType.Chain,
            from: TBTC,
            to: LBTC,
            claimDetails: { ...baseDetails, keyIndex: 11 },
        };

        const mapped = mapSwap(swap);
        expect(mapped).toMatchObject({
            type: SwapType.Chain,
            assetSend: TBTC,
            assetReceive: LBTC,
            version: OutputType.Taproot,
            claimPrivateKeyIndex: 11,
        });
        expect(mapped).not.toHaveProperty("lockupDetails");
        expect(mapped).not.toHaveProperty("refundPrivateKeyIndex");
    });
});

describe("RefundRescue", () => {
    const renderPage = () =>
        render(
            () => (
                <>
                    <TestComponent />
                    <RefundRescue />
                </>
            ),
            { wrapper: contextWrapper },
        );

    beforeEach(() => {
        vi.clearAllMocks();
        restorableSwaps.current = [];
        waitForSwapTimeoutState.current = false;
        mockGetSwapStatus.mockResolvedValue({
            status: failedRestorable.status,
            failureReason: "invoice expired",
            transaction: { id: lockupTxId, hex: "00" },
        });
        mockGetRescuableUTXOs.mockResolvedValue([{ id: lockupTxId }]);
    });

    test("shows failure details, status, and the lockup link for a failed restored swap", async () => {
        restorableSwaps.current = [failedRestorable];

        renderPage();

        await waitFor(() => {
            expect(document.querySelector(".frame-header")).toHaveTextContent(
                `Swap: ${pageSwapId}`,
            );
        });

        expect(document.querySelector(".frame")).toHaveAttribute(
            "data-status",
            "transaction.lockupFailed",
        );
        expect(document.querySelector(".swap-status")).toHaveTextContent(
            "transaction.lockupFailed",
        );
        expect(
            document.querySelectorAll(".frame-header .swaplist-asset .asset"),
        ).toHaveLength(2);

        expect(screen.getByText(dict.en.lockup_failed)).toBeInTheDocument();
        expect(
            screen.getByText(`${dict.en.failure_reason}: invoice expired`),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", { name: openLockupTxLabel }),
        ).toBeInTheDocument();
    });

    test("stays alive when the swap list populates after mount and swap() is still null", async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.getByText(dict.en.pay_swap_404)).toBeInTheDocument();
        });

        // The mount resource already ran with an empty list, so swap() stays null
        restorableSwaps.current = [failedRestorable];

        await waitFor(() => {
            expect(document.querySelector(".frame-header")).toHaveTextContent(
                `Swap: ${pageSwapId}`,
            );
        });

        expect(screen.getByTestId("refundButton")).toBeInTheDocument();
        // Hidden rather than dereferencing the null swap()
        expect(
            screen.queryByRole("link", { name: openLockupTxLabel }),
        ).not.toBeInTheDocument();
    });

    test("hides the lockup address link if a waiting chain swap loses its lockup details", async () => {
        waitForSwapTimeoutState.current = true;
        restorableSwaps.current = [
            {
                ...baseSwap,
                id: pageSwapId,
                type: SwapType.Chain,
                from: BTC,
                to: LBTC,
                refundDetails: { ...baseDetails },
            },
        ];
        mockGetCurrentBlockHeight.mockResolvedValue({ [BTC]: 100 });

        renderPage();

        expect(
            await screen.findByRole("link", {
                name: openLockupAddressLabel,
            }),
        ).toBeInTheDocument();

        payContext.setSwap({
            ...payContext.swap()!,
            lockupDetails: undefined,
        } as unknown as ChainSwap);

        await waitFor(() => {
            expect(
                screen.queryByRole("link", {
                    name: openLockupAddressLabel,
                }),
            ).not.toBeInTheDocument();
        });
        expect(screen.getByTestId("backBtn")).toBeInTheDocument();
    });
});
