import { render, screen, waitFor, within } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { type RestorableSwap, getRestorableSwaps } from "boltz-swaps/client";
import {
    BridgeKind,
    RskRescueMode,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import { vi } from "vitest";

import { LN, WBTC } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import RescueExternal from "../../src/pages/external-rescue/RescueExternal";
import { Results } from "../../src/pages/external-rescue/Results";
import { mapRestorableSwaps } from "../../src/pages/external-rescue/scan";
import {
    BtcSearchState,
    RescueResultSource,
} from "../../src/pages/external-rescue/types";
import { RescueAction } from "../../src/utils/rescue";
import {
    type SomeSwap,
    getFinalAssetReceive,
} from "../../src/utils/swapCreator";
import { encryptSwapMetadata } from "../../src/utils/swapMetadata";
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

vi.mock("../../packages/boltz-swaps/src/client.ts", () => {
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
        const lightningChip = screen
            .getByText(LN)
            .closest(".rescue-external-chip") as HTMLElement;
        const tbtcChip = screen
            .getByText("TBTC")
            .closest(".rescue-external-chip") as HTMLElement;
        const wbtcChip = screen
            .getByText(WBTC)
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
        expect(wbtcChip).toHaveAttribute("data-active", "false");
        expect(wbtcChip).toHaveAttribute(
            "data-tooltip",
            i18n.en.rescue_external_requires_rescue_key,
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
        expect(lightningChip).toHaveAttribute("data-active", "true");
        expect(lightningChip).not.toHaveAttribute("data-tooltip");

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

        expect(wbtcChip).toHaveAttribute("data-active", "true");
        expect(wbtcChip).not.toHaveAttribute("data-tooltip");
        expect(
            within(wbtcChip).getByLabelText("Rescue key required"),
        ).toHaveAttribute("data-active", "true");
        expect(
            within(wbtcChip).queryByLabelText("Wallet required"),
        ).not.toBeInTheDocument();

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

    test("should display the metadata final asset for routed restored swaps", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "horse olympic laundry marriage material private arch civil theory crew alone thank";
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
        const swap: RestorableSwap = {
            id: "metadata-swap",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1754409244,
            from: "L-BTC",
            to: "TBTC",
            claimDetails,
            refundDetails: claimDetails,
            metadata: await encryptSwapMetadata(mnemonic, {
                dex: {
                    hops: [{ type: SwapType.Dex, from: "TBTC", to: "USDT0" }],
                    position: SwapPosition.Post,
                    quoteAmount: 10_000,
                },
                bridge: {
                    sourceAsset: "USDT0",
                    destinationAsset: "USDT0-SOL",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Post,
                },
            }),
        };

        const [mapped] = await mapRestorableSwaps([swap], mnemonic);
        const mappedSwap = mapped as Partial<SomeSwap> & { to?: string };
        expect(mappedSwap.to).toBe("TBTC");
        expect(mappedSwap.assetReceive).toBe("TBTC");
        const finalAssetReceive = getFinalAssetReceive(
            mappedSwap as SomeSwap,
            true,
        );
        expect(finalAssetReceive).toBe("USDT0-SOL");

        mockGetRestorableSwaps
            .mockResolvedValueOnce([swap])
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
                mnemonic,
            });
        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        const row = await screen.findByTestId("swaplist-item-metadata-swap");
        expect(row).toHaveTextContent(i18n.en.in_progress);

        const assets = row.querySelectorAll(".asset");
        expect(assets).toHaveLength(2);
        expect(assets[0]).toHaveAttribute("data-asset", "LBTC");
        expect(assets[1]).toHaveAttribute("data-asset", "USDT");
        expect(assets[1]).toHaveAttribute("data-network", "solana");
    });

    test("should display metadata swap assets for routed restored refund rows", () => {
        const result = {
            source: RescueResultSource.Restore,
            key: "restore:metadata-refund-swap",
            action: RescueAction.Refund,
            actionable: true,
            sortValue: 1,
            swap: {
                id: "metadata-refund-swap",
                type: SwapType.Chain,
                status: "transaction.lockupFailed",
                date: 1,
                assetSend: "TBTC",
                assetReceive: "L-BTC",
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: "USDT0",
                            to: "TBTC",
                        },
                    ],
                    position: SwapPosition.Pre,
                    quoteAmount: 13334,
                },
                bridge: {
                    sourceAsset: "USDT0-SOL",
                    destinationAsset: "USDT0",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Pre,
                },
            },
        };

        render(
            () => (
                <>
                    <TestComponent />
                    <Results
                        state={
                            {
                                btc: {
                                    loadedSwaps: 0,
                                    searchState: BtcSearchState.Ready,
                                    listLoading: false,
                                },
                                evm: {
                                    unmatchedRefundSwaps: 0,
                                    unmatchedClaimSwaps: 0,
                                },
                                search: {
                                    hasSearched: true,
                                    isSearching: false,
                                },
                            } as any
                        }
                        results={
                            {
                                all: () => [result],
                                current: () => [result],
                                currentEvmProgress: () => undefined,
                                currentPage: () => 1,
                                displaySlotCount: () => 1,
                                hasAny: () => true,
                                open: vi.fn(),
                                setCurrent: vi.fn(),
                                setCurrentPage: vi.fn(),
                            } as any
                        }
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const row = screen.getByTestId("swaplist-item-metadata-refund-swap");
        const assets = row.querySelectorAll(".asset");

        expect(row).toHaveTextContent(i18n.en.refund);
        expect(assets).toHaveLength(2);
        expect(assets[0]).toHaveAttribute("data-asset", "USDT");
        expect(assets[0]).toHaveAttribute("data-network", "solana");
        expect(assets[1]).toHaveAttribute("data-asset", "LBTC");
        expect(row.querySelector('[data-asset="TBTC"]')).toBeNull();
    });

    test("should show the restored swap id for enriched EVM rows and the tx hash otherwise", () => {
        const enrichedTxHash = `0x${"a".repeat(64)}`;
        const scannedTxHash = `0x${"b".repeat(64)}`;
        const enriched = {
            source: RescueResultSource.Evm,
            key: `evm:claim:TBTC:${enrichedTxHash}`,
            action: RescueAction.Claim,
            evmAction: RskRescueMode.Claim,
            actionable: true,
            sortValue: 100,
            swap: {
                action: RskRescueMode.Claim,
                asset: "TBTC",
                blockNumber: 100,
                transactionHash: enrichedTxHash,
                restoredSwap: {
                    id: "restored-evm-swap",
                    type: SwapType.Reverse,
                    status: "transaction.confirmed",
                    createdAt: 1,
                    from: "L-BTC",
                    to: "TBTC",
                    preimageHash: "bb",
                },
            },
        };
        const scanned = {
            source: RescueResultSource.Evm,
            key: `evm:refund:TBTC:${scannedTxHash}`,
            action: RescueAction.Refund,
            evmAction: RskRescueMode.Refund,
            actionable: true,
            sortValue: 99,
            swap: {
                action: RskRescueMode.Refund,
                asset: "TBTC",
                blockNumber: 99,
                transactionHash: scannedTxHash,
            },
        };
        const results = [enriched, scanned];

        render(
            () => (
                <>
                    <TestComponent />
                    <Results
                        state={
                            {
                                btc: {
                                    loadedSwaps: 0,
                                    searchState: BtcSearchState.Ready,
                                    listLoading: false,
                                },
                                evm: {
                                    unmatchedRefundSwaps: 0,
                                    unmatchedClaimSwaps: 0,
                                },
                                search: {
                                    hasSearched: true,
                                    isSearching: false,
                                },
                            } as any
                        }
                        results={
                            {
                                all: () => results,
                                current: () => results,
                                currentEvmProgress: () => undefined,
                                currentPage: () => 1,
                                displaySlotCount: () => results.length,
                                hasAny: () => true,
                                open: vi.fn(),
                                setCurrent: vi.fn(),
                                setCurrentPage: vi.fn(),
                            } as any
                        }
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const enrichedRow = screen.getByTestId(`swaplist-item-${enriched.key}`);
        expect(
            within(enrichedRow).getByText("restored-evm-swap"),
        ).toBeInTheDocument();

        const scannedRow = screen.getByTestId(`swaplist-item-${scanned.key}`);
        expect(
            within(scannedRow).getByText("0xbbb...bbbbb"),
        ).toBeInTheDocument();
    });
});
