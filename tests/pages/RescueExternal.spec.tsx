import { render, screen, waitFor } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";

import { SwapType } from "../../src/consts/Enums";
import { paginationLimit } from "../../src/consts/Pagination";
import i18n from "../../src/i18n/i18n";
import RescueExternal, { RefundBtcLike } from "../../src/pages/RescueExternal";
import type { RestorableSwap } from "../../src/utils/boltzClient";
import { getRestorableSwaps } from "../../src/utils/boltzClient";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    payContext,
} from "../helper";

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

    describe("BtcLike", () => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockGetRestorableSwaps.mockReset();
        });

        test("should show refund button when file was uploaded", async () => {
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
                    id: "",
                    privateKey: "",
                });
            await user.upload(uploadInput, swapFile);
            payContext.setRefundableUTXOs([{ hex: "0x0" }]);

            expect(
                await screen.findAllByText(i18n.en.refund),
            ).not.toBeUndefined();
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
                    { timeout: 500 },
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
                    { timeout: 500 },
                );

                expect(mockGetRestorableSwaps).toHaveBeenCalledTimes(3);
            });
        });
    });
});
