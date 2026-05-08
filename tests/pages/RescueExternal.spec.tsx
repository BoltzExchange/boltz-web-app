import { render, screen, waitFor, within } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";

import { SwapType } from "../../src/consts/Enums";
import { paginationLimit } from "../../src/consts/Pagination";
import i18n from "../../src/i18n/i18n";
import RescueExternal, { RefundBtcLike } from "../../src/pages/RescueExternal";
import {
    type RestorableSwap,
    getRestorableSwaps,
} from "../../src/utils/boltzClient";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        headers: {
            get: (name: string) => {
                if (name === "content-type") {
                    return "application/json";
                }
                return null;
            },
        },
        json: () => Promise.resolve([]),
        text: () => Promise.resolve("[]"),
    } as Response),
);

Object.defineProperty(global.navigator, "locks", {
    value: {
        request: vi.fn((_name: string, callback: () => Promise<void>) =>
            callback(),
        ),
    },
    writable: true,
    configurable: true,
});

/* eslint-disable  require-await,@typescript-eslint/require-await,@typescript-eslint/no-explicit-any */

vi.mock("../../src/utils/boltzClient", () => {
    return {
        getLockupTransaction: vi.fn(() =>
            Promise.resolve({
                id: "1",
                hex: "0x",
                timeoutBlockHeight: 10,
                timeoutEta: 10,
            }),
        ),
        getRestorableSwaps: vi.fn(),
    };
});

vi.mock("../../src/utils/rescue", async () => {
    const actual = await vi.importActual("../../src/utils/rescue");
    return {
        ...actual,
        getRescuableUTXOs: vi.fn(),
    };
});

const mockGetRestorableSwaps = vi.mocked(getRestorableSwaps);

describe("RescueExternal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRestorableSwaps.mockReset();
    });

    test("should render WASM error", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setWasmSupported(false);
        expect(
            await screen.findAllByText(i18n.en.error_wasm),
        ).not.toBeUndefined();
    });

    test("should render unified recovery method page without tabs", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        expect(
            await screen.findByText(i18n.en.rescue_external_swap),
        ).toBeInTheDocument();
        expect(screen.queryByText("Bitcoin / Liquid")).not.toBeInTheDocument();
        expect(screen.queryByText("EVM")).not.toBeInTheDocument();

        const searchButton = screen.getByRole("button", {
            name: i18n.en.rescue_external_select_method,
        });
        expect(searchButton).toBeDisabled();
    });

    test("should enable search after rescue key upload without auto-searching", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as any).text = async () =>
            JSON.stringify({
                mnemonic:
                    "horse olympic laundry marriage material private arch civil theory crew alone thank",
            });
        await user.upload(uploadInput, rescueFile);

        expect(mockGetRestorableSwaps).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", { name: i18n.en.rescue }),
        ).toBeEnabled();
        expect(
            screen.getByText("BTC").closest(".rescue-external-chip"),
        ).toHaveAttribute("data-active", "true");
    });

    test("should update recovery requirement chips after rescue key upload", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const btcChip = (await screen.findByText("BTC")).closest(
            ".rescue-external-chip",
        ) as HTMLElement;
        const tbtcChip = screen
            .getByText("TBTC")
            .closest(".rescue-external-chip") as HTMLElement;
        const rbtcRefundChip = screen
            .getByText(`RBTC (${i18n.en.refund})`)
            .closest(".rescue-external-chip") as HTMLElement;
        const rbtcResumeChip = screen
            .getByText(`RBTC (${i18n.en.rescue_external_resume})`)
            .closest(".rescue-external-chip") as HTMLElement;

        expect(btcChip).toHaveAttribute("data-active", "false");
        expect(btcChip).toHaveAttribute(
            "data-tooltip",
            i18n.en.rescue_external_requires_rescue_key,
        );
        expect(tbtcChip).toHaveAttribute("data-active", "false");
        expect(tbtcChip).toHaveAttribute(
            "data-tooltip",
            i18n.en.rescue_external_requires_rescue_key_wallet,
        );

        const uploadInput = screen.getByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as any).text = async () =>
            JSON.stringify({
                mnemonic:
                    "horse olympic laundry marriage material private arch civil theory crew alone thank",
            });
        await user.upload(uploadInput, rescueFile);

        expect(btcChip).toHaveAttribute("data-active", "true");
        expect(btcChip).not.toHaveAttribute("data-tooltip");

        expect(rbtcRefundChip).toHaveAttribute("data-active", "false");
        expect(rbtcRefundChip).toHaveAttribute(
            "data-tooltip",
            i18n.en.rescue_external_requires_wallet,
        );
        expect(
            within(rbtcRefundChip).getByLabelText("Wallet required"),
        ).toHaveAttribute("data-active", "false");

        expect(tbtcChip).toHaveAttribute("data-active", "false");
        expect(tbtcChip).toHaveAttribute(
            "data-tooltip",
            i18n.en.rescue_external_requires_rescue_key_wallet,
        );
        expect(
            within(tbtcChip).getByLabelText("Rescue key required"),
        ).toHaveAttribute("data-active", "true");
        expect(
            within(tbtcChip).getByLabelText("Wallet required"),
        ).toHaveAttribute("data-active", "false");

        expect(rbtcResumeChip).toHaveAttribute("data-active", "false");
        expect(rbtcResumeChip).toHaveAttribute(
            "data-tooltip",
            i18n.en.rescue_external_requires_rescue_key_wallet,
        );
        expect(
            within(rbtcResumeChip).getByLabelText("Rescue key required"),
        ).toHaveAttribute("data-active", "true");
        expect(
            within(rbtcResumeChip).getByLabelText("Wallet required"),
        ).toHaveAttribute("data-active", "false");
    });

    test("should simplify manual rescue key entry on the unified page", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        await user.click(await screen.findByTestId("enterMnemonicBtn"));

        expect(screen.getByTestId("backBtn")).toHaveTextContent(
            i18n.en.upload_rescue_key,
        );
        expect(screen.queryByTestId("import-key-button")).toBeNull();

        await user.click(screen.getByTestId("backBtn"));
        expect(await screen.findByTestId("refundUpload")).toBeInTheDocument();
    });

    test("should hide recovery inputs while searching and restore them on back", async () => {
        const user = userEvent.setup();
        let resolveRestore!: (swaps: RestorableSwap[]) => void;
        let restoreSignal: AbortSignal | undefined;

        mockGetRestorableSwaps.mockImplementation(
            (_xpub, _pagination, signal) => {
                restoreSignal = signal;
                return new Promise<RestorableSwap[]>((resolve) => {
                    resolveRestore = resolve;
                });
            },
        );

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as any).text = async () =>
            JSON.stringify({
                mnemonic:
                    "horse olympic laundry marriage material private arch civil theory crew alone thank",
            });
        await user.upload(uploadInput, rescueFile);
        expect(screen.getByText("rescue.json")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(screen.queryByTestId("refundUpload")).toBeNull();
        });
        expect(
            screen.queryByRole("button", { name: i18n.en.connect_wallet }),
        ).toBeNull();

        await user.click(screen.getByRole("button", { name: i18n.en.back }));

        expect(restoreSignal?.aborted).toBe(true);
        expect(await screen.findByTestId("refundUpload")).toBeInTheDocument();
        expect(screen.getByText("rescue.json")).toBeInTheDocument();
        resolveRestore([]);
    });

    test("should not preserve uploaded rescue key after leaving the page", async () => {
        const user = userEvent.setup();

        const firstRender = render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as any).text = async () =>
            JSON.stringify({
                mnemonic:
                    "horse olympic laundry marriage material private arch civil theory crew alone thank",
            });
        await user.upload(uploadInput, rescueFile);

        expect(screen.getByText("rescue.json")).toBeInTheDocument();
        firstRender.unmount();

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        expect(await screen.findByTestId("refundUpload")).toBeInTheDocument();
        expect(screen.queryByText("rescue.json")).toBeNull();
        expect(
            screen.getByRole("button", {
                name: i18n.en.rescue_external_select_method,
            }),
        ).toBeDisabled();
    });

    test("should render one action-sorted result list", async () => {
        const user = userEvent.setup();
        const swapTree = {
            claimLeaf: {
                version: 192,
                output: "a914aa856454ae0e8e8e0bf3e625421e13e168bd9d5d8820395d9749b27c5908e2e8e95237cf8d1c704c48b19e51f915c9986a1973925567ac",
            },
            refundLeaf: {
                version: 192,
                output: "208f7d52e62a440dec6c17cf929889df5abdbe85158834cf5d67e0f957b7ccee53ad02ca04b1",
            },
        };
        const claimDetails = {
            tree: swapTree,
            keyIndex: 0,
            lockupAddress:
                "bcrt1ptwl8vqkgrxz9ydyv5zx8qluv2mpjkg58qry2xvf2qeek7l9uxpusm4tlgf",
            serverPublicKey:
                "02395d9749b27c5908e2e8e95237cf8d1c704c48b19e51f915c9986a1973925567",
            timeoutBlockHeight: 1226,
            amount: 10_000,
        };
        const pendingSwap: RestorableSwap = {
            id: "pending-swap",
            type: SwapType.Reverse,
            status: "invoice.set",
            createdAt: 1754409244,
            from: "BTC",
            to: "L-BTC",
            claimDetails,
        };
        const claimSwap: RestorableSwap = {
            ...pendingSwap,
            id: "claim-swap",
            status: "transaction.confirmed",
            createdAt: 1754409243,
        };

        mockGetRestorableSwaps
            .mockResolvedValueOnce([pendingSwap, claimSwap])
            .mockResolvedValueOnce([]);

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as any).text = async () =>
            JSON.stringify({
                mnemonic:
                    "horse olympic laundry marriage material private arch civil theory crew alone thank",
            });
        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(
                screen.getByTestId("swaplist-item-claim-swap"),
            ).toBeInTheDocument();
        });

        const rows = document.querySelectorAll(
            ".rescue-external-result-list .swaplist-item",
        );
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveAttribute(
            "data-testid",
            "swaplist-item-claim-swap",
        );
        expect(rows[1]).toHaveClass("disabled");
    });

    describe("BtcLike", () => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockGetRestorableSwaps.mockReset();
        });

        test("should show invalid refund button when invalid file was uploaded", async () => {
            const user = userEvent.setup();
            render(
                () => (
                    <>
                        <TestComponent />
                        <RefundBtcLike />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            const uploadInput = await screen.findByTestId("refundUpload");
            const swapFile = new File(["{}"], "swap.json", {
                type: "application/json",
            });
            (swapFile as any).text = async () =>
                JSON.stringify({
                    asset: "BTC",
                });
            await user.upload(uploadInput, swapFile);

            expect(
                await screen.findAllByText(i18n.en.invalid_refund_file),
            ).not.toBeUndefined();
        });

        describe("Pagination", () => {
            const validRescueFile = {
                mnemonic:
                    "horse olympic laundry marriage material private arch civil theory crew alone thank",
            };

            const createMockSwap = (index: number): RestorableSwap => ({
                id: `swap-${index}`,
                type: SwapType.Submarine,
                status: "transaction.claimed",
                createdAt: 1754409243 + index,
                from: "BTC",
                to: "BTC",
                refundDetails: {
                    tree: {
                        claimLeaf: {
                            version: 192,
                            output: "a914aa856454ae0e8e8e0bf3e625421e13e168bd9d5d8820395d9749b27c5908e2e8e95237cf8d1c704c48b19e51f915c9986a1973925567ac",
                        },
                        refundLeaf: {
                            version: 192,
                            output: "208f7d52e62a440dec6c17cf929889df5abdbe85158834cf5d67e0f957b7ccee53ad02ca04b1",
                        },
                    },
                    keyIndex: index,
                    lockupAddress:
                        "bcrt1ptwl8vqkgrxz9ydyv5zx8qluv2mpjkg58qry2xvf2qeek7l9uxpusm4tlgf",
                    serverPublicKey:
                        "02395d9749b27c5908e2e8e95237cf8d1c704c48b19e51f915c9986a1973925567",
                    timeoutBlockHeight: 1226,
                },
            });

            test("should fetch multiple pages until it runs out of swaps", async () => {
                const user = userEvent.setup();

                mockGetRestorableSwaps.mockResolvedValueOnce(
                    Array.from({ length: paginationLimit }, (_, i) =>
                        createMockSwap(i),
                    ),
                );

                mockGetRestorableSwaps.mockResolvedValueOnce(
                    Array.from({ length: paginationLimit - 1 }, (_, i) =>
                        createMockSwap(i + paginationLimit),
                    ),
                );

                mockGetRestorableSwaps.mockResolvedValueOnce([]);

                render(
                    () => (
                        <>
                            <TestComponent />
                            <RefundBtcLike />
                        </>
                    ),
                    {
                        wrapper: contextWrapper,
                    },
                );

                const uploadInput = await screen.findByTestId("refundUpload");
                const rescueFile = new File(["{}"], "rescue.json", {
                    type: "application/json",
                });
                (rescueFile as any).text = async () =>
                    JSON.stringify(validRescueFile);
                await user.upload(uploadInput, rescueFile);

                expect(mockGetRestorableSwaps).toHaveBeenCalledTimes(3);
            });

            test("should stop immediately when empty array is returned", async () => {
                const user = userEvent.setup();

                mockGetRestorableSwaps.mockResolvedValueOnce([]);

                render(
                    () => (
                        <>
                            <TestComponent />
                            <RefundBtcLike />
                        </>
                    ),
                    {
                        wrapper: contextWrapper,
                    },
                );

                const uploadInput = await screen.findByTestId("refundUpload");
                const rescueFile = new File(["{}"], "rescue.json", {
                    type: "application/json",
                });
                (rescueFile as any).text = async () =>
                    JSON.stringify(validRescueFile);
                await user.upload(uploadInput, rescueFile);

                expect(mockGetRestorableSwaps).toHaveBeenCalledOnce();

                await waitFor(() => {
                    expect(
                        screen.getByText(i18n.en.no_swaps_found),
                    ).toBeInTheDocument();
                });
            });

            test("should display loading progress with correct count during pagination", async () => {
                const user = userEvent.setup();
                const additionalSwaps = 100;

                mockGetRestorableSwaps.mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(
                                    Array.from(
                                        { length: paginationLimit },
                                        (_, i) => createMockSwap(i),
                                    ),
                                );
                            }, 100);
                        }),
                );

                mockGetRestorableSwaps.mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(
                                    Array.from(
                                        { length: additionalSwaps },
                                        (_, i) =>
                                            createMockSwap(i + paginationLimit),
                                    ),
                                );
                            }, 100);
                        }),
                );

                mockGetRestorableSwaps.mockResolvedValueOnce([]);

                render(
                    () => (
                        <>
                            <TestComponent />
                            <RefundBtcLike />
                        </>
                    ),
                    {
                        wrapper: contextWrapper,
                    },
                );

                const uploadInput = await screen.findByTestId("refundUpload");
                const rescueFile = new File(["{}"], "rescue.json", {
                    type: "application/json",
                });
                (rescueFile as any).text = async () =>
                    JSON.stringify(validRescueFile);
                await user.upload(uploadInput, rescueFile);

                await waitFor(
                    () => {
                        const progressText = screen.getByText(
                            i18n.en.swaps_found.replace(
                                "{{ count }}",
                                paginationLimit.toString(),
                            ),
                        );
                        expect(progressText).toBeInTheDocument();
                    },
                    { timeout: 2_000 },
                );

                await waitFor(
                    () => {
                        const progressText = screen.getByText(
                            i18n.en.swaps_found.replace(
                                "{{ count }}",
                                (paginationLimit + additionalSwaps).toString(),
                            ),
                        );
                        expect(progressText).toBeInTheDocument();
                    },
                    { timeout: 2_000 },
                );

                expect(mockGetRestorableSwaps).toHaveBeenCalledTimes(3);
            });
        });
    });
});
