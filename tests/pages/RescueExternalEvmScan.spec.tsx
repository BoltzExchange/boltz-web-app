import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { type RestorableSwap, getRestorableSwaps } from "boltz-swaps/client";
import {
    BridgeKind,
    RskRescueMode,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import type { JSX } from "solid-js";
import { vi } from "vitest";

import { TBTC, WBTC } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import Rescue from "../../src/pages/Rescue";
import type * as RescueUtils from "../../src/utils/rescue";
import { derivePreimageFromRescueKey } from "../../src/utils/rescueFile";
import { encryptSwapMetadata } from "../../src/utils/swapMetadata";
import { TestComponent, contextWrapper } from "../helper";

const {
    mockCreateRescueList,
    mockGetErc20Swap,
    mockGetLogsFromReceipt,
    mockGetTransaction,
    mockGetSweepableGasAbstractionBalances,
    mockPreimageHashesWorker,
    mockRestoreByAddressFetch,
    mockScanLockupEvents,
    mockSigner,
} = vi.hoisted(() => ({
    mockCreateRescueList: vi.fn(),
    mockGetErc20Swap: vi.fn(() => ({})),
    mockGetLogsFromReceipt: vi.fn(),
    mockGetTransaction: vi.fn(() => Promise.resolve({ input: "0x" })),
    mockGetSweepableGasAbstractionBalances: vi.fn(),
    mockRestoreByAddressFetch: vi.fn(),
    mockPreimageHashesWorker: vi.fn(function PreimageHashesWorker() {
        return {
            isDone: true,
            map: new Map([
                [
                    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    {
                        index: 0,
                        preimage:
                            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                    },
                ],
            ]),
            start: vi.fn(),
            terminate: vi.fn(),
            waitForNextBatch: vi.fn(),
        };
    }),
    mockScanLockupEvents: vi.fn(async function* (): AsyncGenerator<{
        derivedKeys?: number;
        events: unknown[];
        progress: number;
        unmatchedSwaps: number;
    }> {
        await Promise.resolve();
        yield {
            derivedKeys: undefined,
            events: [],
            progress: 1,
            unmatchedSwaps: 0,
        };
    }),
    mockSigner: {
        current: {
            address: "0x0000000000000000000000000000000000000001",
        } as { address: string } | undefined,
    },
}));

vi.mock("boltz-swaps/client", () => ({
    getRestorableSwaps: vi.fn(),
}));

vi.mock("boltz-swaps/evm", () => ({
    assetAmountToSats: (amount: bigint, asset?: string) =>
        asset === "TBTC" ? amount / 10n ** 10n : amount,
    createAssetProvider: vi.fn(() => ({})),
    createProvider: vi.fn(() => ({ getTransaction: mockGetTransaction })),
    getLogsFromReceipt: mockGetLogsFromReceipt,
    getTimelockBlockNumber: vi.fn(() => Promise.resolve(0)),
    isEmptyPreimageHash: (preimageHash: string | undefined) =>
        preimageHash?.replace(/^0x/i, "").toLowerCase() === "00".repeat(32),
    satsToAssetAmount: (amount: number | bigint, asset?: string) =>
        asset === "TBTC" ? BigInt(amount) * 10n ** 10n : BigInt(amount),
    scanLockupEvents: mockScanLockupEvents,
}));

vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <button type="button">{i18n.en.connect_wallet}</button>,
}));

vi.mock("../../src/context/Web3", () => ({
    Web3SignerProvider: (props: { children: JSX.Element }) => (
        <>{props.children}</>
    ),
    useWeb3Signer: () => ({
        browserWalletTransports: () => new Set(),
        clearSigner: vi.fn(),
        connectProvider: vi.fn(),
        connectProviderForAddress: vi.fn(),
        connectedWallet: () => ({
            address: "0x0000000000000000000000000000000000000001",
            rdns: "test",
            transport: "evm",
        }),
        getContractsForAsset: vi.fn(),
        getErc20Swap: mockGetErc20Swap,
        getEtherSwap: vi.fn(() => ({})),
        getGasAbstractionSigner: vi.fn(),
        getSwapContractVersion: vi.fn(() => 6),
        openWalletConnectModal: () => false,
        providers: () => ({}),
        setOpenWalletConnectModal: vi.fn(),
        setWalletConnected: vi.fn(),
        signer: () => mockSigner.current,
        switchNetwork: vi.fn(),
        walletConnected: () => true,
    }),
}));

vi.mock("../../src/utils/gasAbstractionSweep", () => ({
    getSweepableGasAbstractionBalances: mockGetSweepableGasAbstractionBalances,
}));

vi.mock("../../src/utils/rescue", async (importOriginal) => {
    const actual = await importOriginal<typeof RescueUtils>();
    return {
        ...actual,
        createRescueList: mockCreateRescueList,
    };
});

vi.mock("../../src/workers/preimageHashes/PreimageHashesWorker", () => ({
    PreimageHashesWorker: mockPreimageHashesWorker,
}));

const mockGetRestorableSwaps = vi.mocked(getRestorableSwaps);

describe("Rescue EVM scan", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("VITE_RSK_LOG_SCAN_ENDPOINT", "http://localhost:8545");
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "");
        mockGetRestorableSwaps.mockResolvedValue([]);
        mockRestoreByAddressFetch.mockResolvedValue(
            new Response(JSON.stringify([]), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", mockRestoreByAddressFetch);
        mockCreateRescueList.mockImplementation(
            (swaps: Record<string, unknown>[]) =>
                Promise.resolve(
                    swaps.map((swap) => ({ ...swap, action: "pending" })),
                ),
        );
        mockGetTransaction.mockResolvedValue({ input: "0x" });
        mockGetSweepableGasAbstractionBalances.mockResolvedValue([]);
        mockSigner.current = {
            address: "0x0000000000000000000000000000000000000001",
        };
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    test("passes a preimage derivation worker to claim scans", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(
                JSON.stringify({
                    mnemonic:
                        "horse olympic laundry marriage material private arch civil theory crew alone thank",
                }),
            );

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(mockScanLockupEvents).toHaveBeenCalledWith(
                expect.any(AbortSignal),
                expect.anything(),
                expect.objectContaining({
                    action: RskRescueMode.Claim,
                    mnemonic: expect.any(String),
                }),
                expect.any(Object),
            );
        });
        expect(mockPreimageHashesWorker).toHaveBeenCalledTimes(1);
    });

    test("queries backend restore with rescue xpub", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(
                JSON.stringify({
                    mnemonic:
                        "horse olympic laundry marriage material private arch civil theory crew alone thank",
                }),
            );

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(mockGetRestorableSwaps).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ startIndex: 0 }),
                expect.any(AbortSignal),
            );
        });
        expect(mockGetRestorableSwaps).toHaveBeenCalledTimes(1);
    });

    test("restores DEX refunds with only the rescue key", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "awake father sword slab matrix myth cargo lock river thumb inspire speed";
        const transactionHash =
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "http://localhost:8547");
        const { getEvmRestoreAccounts } =
            await import("../../src/pages/external-rescue/scan");
        const refundAddress = getEvmRestoreAccounts({ mnemonic })[0].account
            .address;
        const restoredSwap: RestorableSwap = {
            id: "restored-refund",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1,
            from: TBTC,
            to: "L-BTC",
            preimageHash:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            metadata: await encryptSwapMetadata(mnemonic, {
                swapId: "restored-refund",
                lockupTx: transactionHash,
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: "USDT0",
                            to: TBTC,
                        },
                    ],
                    position: SwapPosition.Pre,
                    quoteAmount: 1_000,
                },
            }),
        };
        mockSigner.current = undefined;
        mockRestoreByAddressFetch.mockResolvedValue(
            new Response(JSON.stringify([restoredSwap]), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );
        mockGetLogsFromReceipt.mockResolvedValue({
            asset: TBTC,
            blockNumber: 100,
            transactionHash,
            preimageHash: restoredSwap.preimageHash,
            amount: 1_000_000_000_000n,
            claimAddress: "0x0000000000000000000000000000000000000002",
            refundAddress,
            timelock: 0n,
        });

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(JSON.stringify({ mnemonic }));

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        const row = await screen.findByTestId(
            `swaplist-item-evm:${RskRescueMode.Refund}:${TBTC}:${transactionHash}`,
        );
        expect(row).toHaveTextContent(i18n.en.refund);
        expect(row).not.toHaveClass("disabled");
        await waitFor(() => {
            expect(mockScanLockupEvents).toHaveBeenCalledWith(
                expect.any(AbortSignal),
                expect.anything(),
                expect.objectContaining({
                    action: RskRescueMode.Refund,
                    filter: expect.objectContaining({
                        address: refundAddress,
                    }),
                }),
                undefined,
            );
            expect(mockScanLockupEvents).toHaveBeenCalledWith(
                expect.any(AbortSignal),
                expect.anything(),
                expect.objectContaining({
                    action: RskRescueMode.Claim,
                    filter: expect.objectContaining({
                        address: refundAddress,
                    }),
                }),
                expect.any(Object),
            );
        });
        const scannedAssets = (
            mockScanLockupEvents.mock.calls as unknown[][]
        ).map((call) => (call[2] as { asset: string }).asset);
        expect(scannedAssets).not.toContain("RBTC");
    });

    test("rejects restored refunds whose refund address is not a rescue key", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "awake father sword slab matrix myth cargo lock river thumb inspire speed";
        const transactionHash =
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "http://localhost:8547");
        const restoredSwap: RestorableSwap = {
            id: "restored-refund",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1,
            from: TBTC,
            to: "L-BTC",
            preimageHash:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            metadata: await encryptSwapMetadata(mnemonic, {
                swapId: "restored-refund",
                lockupTx: transactionHash,
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: "USDT0",
                            to: TBTC,
                        },
                    ],
                    position: SwapPosition.Pre,
                    quoteAmount: 1_000,
                },
            }),
        };
        mockSigner.current = undefined;
        mockRestoreByAddressFetch.mockResolvedValue(
            new Response(JSON.stringify([restoredSwap]), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );
        mockGetLogsFromReceipt.mockResolvedValue({
            asset: TBTC,
            blockNumber: 100,
            transactionHash,
            preimageHash: restoredSwap.preimageHash,
            amount: 1_000_000_000_000n,
            claimAddress: "0x0000000000000000000000000000000000000002",
            refundAddress: "0x00000000000000000000000000000000000000ff",
            timelock: 0n,
        });

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(JSON.stringify({ mnemonic }));

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(mockGetLogsFromReceipt).toHaveBeenCalled();
        });
        await expect(
            screen.findByTestId(
                `swaplist-item-evm:${RskRescueMode.Refund}:${TBTC}:${transactionHash}`,
                {},
                { timeout: 1_500 },
            ),
        ).rejects.toThrow();
    });

    test("renders signed EVM address restore results as claim rows", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "awake father sword slab matrix myth cargo lock river thumb inspire speed";
        const transactionHash =
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const preimage = derivePreimageFromRescueKey({ mnemonic }, 0, TBTC);
        const restoredSwap: RestorableSwap = {
            id: "evm-address-restored",
            type: SwapType.Reverse,
            status: "transaction.confirmed",
            createdAt: 1,
            from: "BTC",
            to: TBTC,
            preimageHash: hex.encode(sha256(preimage)),
            evmClaimDetails: {
                amount: 1_000,
                claimAddress: "0x0000000000000000000000000000000000000001",
                contractAddress: "0x0000000000000000000000000000000000000003",
                keyIndex: 0,
                timeoutBlockHeight: 123,
                transaction: { id: transactionHash },
            } as RestorableSwap["evmClaimDetails"],
            metadata: await encryptSwapMetadata(mnemonic, {
                swapId: "evm-address-restored",
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: TBTC,
                            to: "USDT0",
                            dexDetails: {
                                chain: "ARB",
                                tokenIn:
                                    "0x0000000000000000000000000000000000000004",
                                tokenOut:
                                    "0x0000000000000000000000000000000000000005",
                            },
                        },
                    ],
                    position: SwapPosition.Post,
                    quoteAmount: 1_000,
                },
                bridge: {
                    sourceAsset: "USDT0",
                    destinationAsset: "USDT0-SOL",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Post,
                },
            }),
        };
        mockRestoreByAddressFetch.mockResolvedValue(
            new Response(JSON.stringify([restoredSwap]), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(JSON.stringify({ mnemonic }));

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        const row = await screen.findByTestId(
            `swaplist-item-evm:${RskRescueMode.Claim}:${TBTC}:${transactionHash}`,
        );
        const assets = row.querySelectorAll(".asset");

        expect(row).not.toHaveClass("disabled");
        expect(row).toHaveTextContent(i18n.en.claim);
        expect(
            screen.queryByTestId("swaplist-item-evm-address-restored"),
        ).toBeNull();
        expect(assets).toHaveLength(2);
        expect(assets[0]).toHaveAttribute("data-asset", "LN");
        expect(assets[1]).toHaveAttribute("data-asset", "USDT");
        expect(assets[1]).toHaveAttribute("data-network", "solana");
    });

    test("does not render restored EVM claims without a scanner-confirmed lockup", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "horse olympic laundry marriage material private arch civil theory crew alone thank";
        const transactionHash =
            "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

        mockGetRestorableSwaps.mockResolvedValueOnce([
            {
                id: "restored-claim-only",
                type: SwapType.Chain,
                status: "transaction.server.confirmed",
                createdAt: 1,
                from: "L-BTC",
                to: TBTC,
                preimageHash:
                    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                evmClaimDetails: {
                    amount: 1_000,
                    claimAddress: "0x0000000000000000000000000000000000000001",
                    contractAddress:
                        "0x0000000000000000000000000000000000000003",
                    timeoutBlockHeight: 123,
                    transaction: { id: transactionHash },
                },
            } as RestorableSwap,
        ]);

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(JSON.stringify({ mnemonic }));

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() =>
            expect(mockGetRestorableSwaps).toHaveBeenCalledTimes(2),
        );
        await waitFor(() => expect(mockScanLockupEvents).toHaveBeenCalled());
        await waitFor(() =>
            expect(screen.queryByText(/Scan progress/)).toBeNull(),
        );

        expect(
            screen.queryByTestId(
                `swaplist-item-evm:${RskRescueMode.Claim}:${TBTC}:${transactionHash}`,
            ),
        ).toBeNull();
        expect(screen.queryByText("block: 0")).toBeNull();
    });

    test("renders restored EVM claim metadata as original swap assets", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "horse olympic laundry marriage material private arch civil theory crew alone thank";
        const transactionHash =
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "http://localhost:8547");

        const restoredSwap: RestorableSwap = {
            id: "restored-evm",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1,
            from: "L-BTC",
            to: TBTC,
            preimageHash:
                "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            evmClaimDetails: {
                amount: 1_000,
                claimAddress: "0x0000000000000000000000000000000000000001",
                contractAddress: "0x0000000000000000000000000000000000000003",
                timeoutBlockHeight: 123,
                transaction: { id: transactionHash },
            },
            metadata: await encryptSwapMetadata(mnemonic, {
                swapId: "restored-evm",
                lockupTx: transactionHash,
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: TBTC,
                            to: "USDT0",
                            dexDetails: {
                                chain: "ARB",
                                tokenIn:
                                    "0x0000000000000000000000000000000000000004",
                                tokenOut:
                                    "0x0000000000000000000000000000000000000005",
                            },
                        },
                    ],
                    position: SwapPosition.Post,
                    quoteAmount: 1_000,
                },
                bridge: {
                    sourceAsset: "USDT0",
                    destinationAsset: "USDT0-SOL",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Post,
                },
            }),
        };
        mockGetRestorableSwaps.mockResolvedValueOnce([restoredSwap]);
        mockScanLockupEvents.mockImplementation(async function* (
            ...args: unknown[]
        ) {
            await Promise.resolve();
            const config = args[2] as {
                action?: RskRescueMode;
                asset?: string;
            };
            yield {
                derivedKeys: undefined,
                events:
                    config.action === RskRescueMode.Claim &&
                    config.asset === TBTC
                        ? [
                              {
                                  asset: TBTC,
                                  blockNumber: 100,
                                  transactionHash,
                                  preimageHash:
                                      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                                  amount: 1_000n,
                                  claimAddress:
                                      "0x0000000000000000000000000000000000000001",
                                  refundAddress:
                                      "0x0000000000000000000000000000000000000002",
                                  timelock: 123n,
                              },
                          ]
                        : [],
                progress: 1,
                unmatchedSwaps: 0,
            };
        });

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(JSON.stringify({ mnemonic }));

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        const row = await screen.findByTestId(
            `swaplist-item-evm:${RskRescueMode.Claim}:${TBTC}:${transactionHash}`,
        );
        const assets = row.querySelectorAll(".asset");

        expect(assets).toHaveLength(2);
        expect(assets[0]).toHaveAttribute("data-asset", "LBTC");
        expect(assets[1]).toHaveAttribute("data-asset", "USDT");
        expect(assets[1]).toHaveAttribute("data-network", "solana");
    });

    test("deduplicates regular restore metadata with chain-scanned EVM claim", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "horse olympic laundry marriage material private arch civil theory crew alone thank";
        const preimageHash =
            "1511378baf1ce4b03edeeb340c6f4f456629674846e96b1912944971605827a6";
        const transactionHash =
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "http://localhost:8547");

        const restoredSwap: RestorableSwap = {
            id: "GpfGQX5voYWC",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1780894795,
            from: "L-BTC",
            to: TBTC,
            preimageHash,
            refundDetails: {
                amount: 1105,
                blindingKey:
                    "340c4b1433ad946e134e46a2593696ec43364a1b6dfe7e7cddb029e6d2127229",
                keyIndex: 1,
                lockupAddress:
                    "lq1pq2vj4xa85w2yu9sahuauk2c3w3cdynqv54vv4z3z2ukeu5ah09tymaag3udz9d4x3ux04juyscnsjjpda0w9dytrtrlf2epj9skr3jdyq5433g3qj7yv",
                serverPublicKey:
                    "038028b1547af7ca73b3cf46b9fbdc4d95ebb9c3abfadbff4e03ff79e13c0eb751",
                timeoutBlockHeight: 3922386,
                transaction: {
                    id: "a4798e0e5d0e84c18025a4d96dca57abdf633d5760d1550c94cece1e41ce5cd9",
                    vout: 0,
                },
                tree: {
                    claimLeaf: {
                        version: 196,
                        output: "82012088a914099ad1bfe70691a567c6efc94547c5108aca7bbf88208028b1547af7ca73b3cf46b9fbdc4d95ebb9c3abfadbff4e03ff79e13c0eb751ac",
                    },
                    refundLeaf: {
                        version: 196,
                        output: "203cb0e1738c72c2fe40e30d79c728a5a5200b58c422675f474c9d5af31aa4bd30ad03d2d93bb1",
                    },
                },
            },
            metadata: await encryptSwapMetadata(mnemonic, {
                swapId: "GpfGQX5voYWC",
                lockupTx: transactionHash,
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: TBTC,
                            to: "USDT0",
                            dexDetails: {
                                chain: "ARB",
                                tokenIn:
                                    "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40",
                                tokenOut:
                                    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                            },
                        },
                    ],
                    position: SwapPosition.Post,
                    quoteAmount: 0,
                },
                bridge: {
                    sourceAsset: "USDT0",
                    destinationAsset: "USDT0-SOL",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Post,
                },
            }),
        };
        mockGetRestorableSwaps
            .mockResolvedValueOnce([restoredSwap])
            .mockResolvedValueOnce([]);
        mockScanLockupEvents.mockImplementation(async function* (
            ...args: unknown[]
        ) {
            await Promise.resolve();
            const config = args[2] as {
                action?: RskRescueMode;
                asset?: string;
            };
            yield {
                derivedKeys: undefined,
                events:
                    config.action === RskRescueMode.Claim &&
                    config.asset === TBTC
                        ? [
                              {
                                  asset: TBTC,
                                  blockNumber: 100,
                                  transactionHash,
                                  preimage:
                                      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                                  preimageHash: `0x${preimageHash}`,
                                  amount: 1105n,
                                  claimAddress:
                                      "0x0000000000000000000000000000000000000001",
                                  refundAddress:
                                      "0x0000000000000000000000000000000000000002",
                                  timelock: 123n,
                              },
                          ]
                        : [],
                progress: 1,
                unmatchedSwaps: 0,
            };
        });

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(JSON.stringify({ mnemonic }));

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        const row = await screen.findByTestId(
            `swaplist-item-evm:${RskRescueMode.Claim}:${TBTC}:${transactionHash}`,
        );
        const assets = row.querySelectorAll(".asset");

        expect(row).not.toHaveClass("disabled");
        expect(row).toHaveTextContent(i18n.en.claim);
        expect(screen.queryByTestId("swaplist-item-GpfGQX5voYWC")).toBeNull();
        expect(assets).toHaveLength(2);
        expect(assets[0]).toHaveAttribute("data-asset", "LBTC");
        expect(assets[1]).toHaveAttribute("data-asset", "USDT");
        expect(assets[1]).toHaveAttribute("data-network", "solana");
    });

    test("keeps zero-preimage EVM refund rows separate from restored routed metadata", async () => {
        const user = userEvent.setup();
        const mnemonic =
            "awake father sword slab matrix myth cargo lock river thumb inspire speed";
        const transactionHash =
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "http://localhost:8547");

        const restoredSwap: RestorableSwap = {
            id: "QzNPe7rckJCp",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1782787562,
            from: TBTC,
            to: "L-BTC",
            preimageHash:
                "c75a1b92ece410e13823372edceb1fc148c37d36586c2ccd8b2c78dac1556a8e",
            claimDetails: {
                amount: 13_341,
                blindingKey:
                    "c43345f5cbf63cd5be4044c0eb7b0991cc2465599fcf2e8d6127ec3847943dc4",
                keyIndex: 71,
                lockupAddress: "lockup",
                serverPublicKey:
                    "03bb779740ad43c9337bf89a23062a8564b2cf5a75fd7e317a352965ee1b4a51b2",
                timeoutBlockHeight: 3953207,
                transaction: {
                    id: "6ba69b919aaf28f5ec746f97cde06da136c77390082de0b52674954b58a51aa1",
                    vout: 1,
                },
                tree: {
                    claimLeaf: { version: 196, output: "51" },
                    refundLeaf: { version: 196, output: "51" },
                },
            },
            metadata: await encryptSwapMetadata(mnemonic, {
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: "USDT0",
                            to: TBTC,
                            dexDetails: {
                                chain: "ARB",
                                tokenIn:
                                    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
                                tokenOut:
                                    "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40",
                            },
                        },
                    ],
                    position: SwapPosition.Pre,
                    quoteAmount: 13_334,
                },
                bridge: {
                    sourceAsset: "USDT0-SOL",
                    destinationAsset: "USDT0",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Pre,
                },
            }),
        };
        mockGetRestorableSwaps.mockResolvedValueOnce([restoredSwap]);
        mockScanLockupEvents.mockImplementation(async function* (
            ...args: unknown[]
        ) {
            await Promise.resolve();
            const config = args[2] as {
                action?: RskRescueMode;
                asset?: string;
            };
            const events =
                config.action === RskRescueMode.Refund && config.asset === TBTC
                    ? [
                          {
                              asset: TBTC,
                              blockNumber: 100,
                              transactionHash,
                              preimageHash: `0x${"00".repeat(32)}`,
                              amount: 99_039_478_307_028n,
                              claimAddress:
                                  "0x0000000000000000000000000000000000000001",
                              refundAddress:
                                  "0x0000000000000000000000000000000000000002",
                              timelock: 123n,
                          },
                      ]
                    : [];
            yield {
                derivedKeys: undefined,
                events,
                progress: 1,
                unmatchedSwaps: 0,
            };
        });

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(JSON.stringify({ mnemonic }));

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        const row = await screen.findByTestId(
            `swaplist-item-evm:${RskRescueMode.Refund}:${TBTC}:${transactionHash}`,
            undefined,
            { timeout: 5_000 },
        );

        expect(row).not.toHaveClass("disabled");
        expect(row).toHaveTextContent(i18n.en.refund);
        await waitFor(() => {
            const currentRow = screen.getByTestId(
                `swaplist-item-evm:${RskRescueMode.Refund}:${TBTC}:${transactionHash}`,
            );
            const assets = currentRow.querySelectorAll(".asset");
            expect(assets).toHaveLength(1);
            expect(assets[0]).toHaveAttribute("data-asset", "TBTC");
        });
    });

    test("scans WBTC and TBTC on Arbitrum", async () => {
        const user = userEvent.setup();
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "http://localhost:8547");

        render(
            () => (
                <>
                    <TestComponent />
                    <Rescue />
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
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(
                JSON.stringify({
                    mnemonic:
                        "horse olympic laundry marriage material private arch civil theory crew alone thank",
                }),
            );

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(mockGetErc20Swap).toHaveBeenCalledWith(TBTC);
            expect(mockGetErc20Swap).toHaveBeenCalledWith(WBTC);
        });

        expect(mockScanLockupEvents).toHaveBeenCalledWith(
            expect.any(AbortSignal),
            expect.anything(),
            expect.objectContaining({
                asset: WBTC,
                providerUrl: "http://localhost:8547",
            }),
            expect.anything(),
        );
    });
});
