import type * as SolidRouter from "@solidjs/router";
import { useLocation, useParams } from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";
import { getLockupTransaction, getSwapStatus } from "boltz-swaps/client";
import { SwapPosition, SwapType } from "boltz-swaps/types";
import { createSignal } from "solid-js";

import { config } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { BTC, LBTC, LN, USDT0 } from "../../src/consts/Assets";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/consts/SwapStatus";
import dict from "../../src/i18n/i18n";
import Pay from "../../src/pages/Pay";
import TransactionMempool from "../../src/status/TransactionMempool";
import {
    getSwapUTXOs,
    getTransactionOutSpend,
} from "../../src/utils/blockchain";
import { claim, findSwapOutputVout } from "../../src/utils/claim";
import {
    getCurrentBlockHeight,
    getTimeoutEta,
    hasSwapTimedOut,
    isRefundableSwapType,
    isSwapClaimable,
} from "../../src/utils/rescue";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
} from "../../src/utils/swapCreator";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    payContext,
} from "../helper";

vi.mock("@solid-primitives/storage", () => ({
    makePersisted: <T,>(signal: T) => signal,
}));
vi.mock("loglevel", () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        rebuild: vi.fn(),
        getLevel: vi.fn(() => 5),
        methodFactory: vi.fn(),
        levels: { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, SILENT: 5 },
    },
}));

vi.mock("../../packages/boltz-swaps/src/client.ts", () => ({
    getSwapStatus: vi.fn(),
    getLockupTransaction: vi.fn(),
}));
vi.mock("../../src/utils/blockchain", async () => {
    const actual = await vi.importActual("../../src/utils/blockchain");
    return {
        ...actual,
        getSwapUTXOs: vi.fn(),
        getTransactionOutSpend: vi.fn(),
    };
});
vi.mock("../../src/utils/claim", () => ({
    claim: vi.fn(),
    createSubmarineSignature: vi.fn(),
    createTheirPartialChainSwapSignature: vi.fn(),
    findSwapOutputVout: vi.fn(),
}));
vi.mock("boltz-swaps/utxo", async () => {
    const actual = await vi.importActual("boltz-swaps/utxo");
    return {
        ...actual,
        getTransaction: vi.fn(() => ({
            fromHex: vi.fn(() => ({})),
        })),
    };
});
vi.mock("../../src/utils/rescue", () => ({
    getCurrentBlockHeight: vi.fn(),
    getTimeoutEta: vi.fn(),
    hasSwapTimedOut: vi.fn(),
    isSwapClaimable: vi.fn(),
    isRefundableSwapType: vi.fn(),
}));
vi.mock("../../src/components/QrCode", () => ({
    default: () => <div data-testid="mock-qrcode" />,
}));
vi.mock("../../src/status/CommitmentCreated", () => ({
    default: () => <div data-testid="commitment-created" />,
}));

const mockGetSwapStatus = vi.mocked(getSwapStatus);
mockGetSwapStatus.mockResolvedValue({
    status: swapStatusFailed.TransactionRefunded,
});
const mockGetSwapUTXOs = vi.mocked(getSwapUTXOs);
const mockGetLockupTransaction = vi.mocked(getLockupTransaction);
const mockGetCurrentBlockHeight = vi.mocked(getCurrentBlockHeight);
const mockGetTimeoutEta = vi.mocked(getTimeoutEta);
const mockHasSwapTimedOut = vi.mocked(hasSwapTimedOut);
const mockIsRefundableSwapType = vi.mocked(isRefundableSwapType);

const { swapsGetItemMock, swapsSetItemMock } = vi.hoisted(() => ({
    swapsGetItemMock: vi.fn(),
    swapsSetItemMock: vi.fn(),
}));

vi.mock("localforage", () => ({
    default: {
        INDEXEDDB: "INDEXEDDB",
        LOCALSTORAGE: "LOCALSTORAGE",
        config: vi.fn(),
        createInstance: vi.fn(() => ({
            getItem: swapsGetItemMock,
            setItem: swapsSetItemMock,
            removeItem: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
            iterate: vi.fn().mockResolvedValue(undefined),
        })),
    },
}));

const mockUseLocation = vi.mocked(useLocation);
const mockUseParams = vi.mocked(useParams);
mockUseLocation.mockReturnValue({
    hash: "",
    key: "",
    pathname: "",
    search: "",
    state: undefined,
} as unknown as ReturnType<typeof useLocation>);

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual<typeof SolidRouter>("@solidjs/router");
    return {
        ...actual,
        useParams: vi.fn(() => ({ id: "123" })), // Mock params.id
        useLocation: vi.fn(() => ({ state: undefined })),
    };
});

const renderPay = (backupDone: boolean = true) => {
    render(
        () => (
            <>
                <TestComponent />
                <Pay />
            </>
        ),
        { wrapper: contextWrapper },
    );

    globalSignals.setRescueFileBackupDone(backupDone);
};

describe("Pay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, "locks", {
            configurable: true,
            value: {
                request: vi.fn(
                    async (_name: string, callback: () => Promise<unknown>) =>
                        await callback(),
                ),
            },
        });
        window.history.replaceState({}, "", "/");
        mockUseParams.mockReturnValue({
            id: "123",
        } as ReturnType<typeof useParams>);
        swapsGetItemMock.mockResolvedValue({
            id: "123",
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: {},
        });
        config.assets!["USDT0-ETH"] ??= structuredClone(
            mainnetConfig.assets!["USDT0-ETH"],
        );
        mockUseLocation.mockReturnValue({
            hash: "",
            key: "",
            pathname: "",
            search: "",
            state: undefined,
        } as unknown as ReturnType<typeof useLocation>);
        mockGetSwapStatus.mockResolvedValue({
            status: swapStatusFailed.TransactionRefunded,
        });
    });

    test("should not show commitment ids in the title", async () => {
        const commitmentId = "commitment-12345678-1234-1234-1234-123456789abc";
        mockUseParams.mockReturnValue({
            id: commitmentId,
        } as ReturnType<typeof useParams>);
        swapsGetItemMock.mockResolvedValue({
            id: commitmentId,
            type: SwapType.Commitment,
            assetReceive: BTC,
            assetSend: LBTC,
        } as SomeSwap);

        renderPay();

        const title = await screen.findByRole("heading", { level: 2 });
        expect(title).not.toHaveTextContent(commitmentId);
    });

    test("should rename `transaction.refunded` to `swap.waitingForRefund` on ChainSwap", async () => {
        renderPay();
        payContext.setSwap({
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: {},
        } as ChainSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const status = await screen.findByText("swap.waitingForRefund");
        expect(status).not.toBeUndefined();
    });

    test("should allow to refund `transaction.refunded` on ChainSwap", async () => {
        renderPay();
        payContext.setSwap({
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: {},
        } as ChainSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const button = (await screen.findByTestId(
            "refundButton",
        )) as HTMLButtonElement;
        expect(button).toBeTruthy();
    });

    test("should not rename `transaction.refunded` status on ReverseSwap", async () => {
        renderPay();
        payContext.setSwap({
            type: SwapType.Reverse,
            assetReceive: LBTC,
            assetSend: BTC,
            lockupDetails: {},
        } as unknown as ReverseSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const status = await screen.findByText("transaction.refunded");
        expect(status).not.toBeUndefined();
    });

    test("should not allow to refund `transaction.refunded` on ReverseSwap", () => {
        renderPay();
        payContext.setSwap({
            type: SwapType.Reverse,
            assetReceive: LBTC,
            assetSend: BTC,
            lockupDetails: {},
        } as unknown as ReverseSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const button = screen.queryByTestId(
            "refundButton",
        ) as HTMLButtonElement;
        expect(button).not.toBeTruthy();
    });

    test("should set status to swap.waitingForRefund when timedOutRefundable is true", async () => {
        mockUseLocation.mockReturnValue({
            ...mockUseLocation(),
            state: { timedOutRefundable: true },
        } as ReturnType<typeof useLocation>);

        mockGetSwapStatus.mockResolvedValue({
            status: swapStatusSuccess.TransactionClaimed, // Frontend should ignore this status when timedOutRefundable is true
        });

        renderPay();

        const status = await screen.findByText("swap.waitingForRefund");
        expect(status).toBeVisible();
    });

    test("should show backup flow and skip status fetch for unverified non-reverse swaps", async () => {
        renderPay(false);

        await screen.findByText(dict.en.download_boltz_rescue_key);
        expect(mockGetSwapStatus).not.toHaveBeenCalled();
    });

    test("should require backup before funding a commitment swap", async () => {
        swapsGetItemMock.mockResolvedValue({
            id: "commitment-123",
            type: SwapType.Commitment,
            assetReceive: LN,
            assetSend: USDT0,
        } as SomeSwap);

        renderPay(false);

        await screen.findByText(dict.en.download_boltz_rescue_key);
        expect(screen.queryByTestId("commitment-created")).toBeNull();

        globalSignals.setRescueFileBackupDone(true);

        expect(await screen.findByTestId("commitment-created")).toBeVisible();
    });

    test("should start backup flow on mnemonic step when ?backup=mnemonic is set", async () => {
        window.history.replaceState({}, "", "/?backup=mnemonic");

        renderPay(false);

        await screen.findByText(dict.en.backup_boltz_rescue_key);
        expect(
            screen.queryByText(dict.en.download_boltz_rescue_key),
        ).toBeNull();
    });

    test("should ignore unknown backup URL param values", async () => {
        window.history.replaceState({}, "", "/?backup=bogus");

        renderPay(false);

        await screen.findByText(dict.en.download_boltz_rescue_key);
        expect(screen.queryByText(dict.en.backup_boltz_rescue_key)).toBeNull();
    });

    test("should fetch status once backup has been verified", async () => {
        mockGetSwapStatus.mockResolvedValue({
            status: swapStatusPending.SwapCreated,
        });

        renderPay(false);
        globalSignals.setRescueFileBackupDone(true);

        await waitFor(() => {
            expect(mockGetSwapStatus).toHaveBeenCalledWith("123");
        });
        expect(await screen.findByText("swap.created")).toBeVisible();
    });

    test.each([
        {
            swapType: SwapType.Submarine,
            assetReceive: LN,
            assetSend: BTC,
        },
        {
            swapType: SwapType.Chain,
            assetReceive: LBTC,
            assetSend: BTC,
        },
    ])(
        "should not attempt to fetch UTXOs for $swapType swap during initial phase",
        ({ swapType, assetReceive, assetSend }) => {
            mockGetSwapStatus.mockResolvedValue({
                status: swapStatusPending.SwapCreated,
            });
            renderPay();
            payContext.setSwap({
                type: swapType,
                assetReceive,
                assetSend,
                lockupDetails: {},
                invoice:
                    swapType === SwapType.Submarine ? "invoice" : undefined,
            } as unknown as SomeSwap);

            // Check for all possible values of prevSwapStatus
            const prevSwapStatuses = ["", null, undefined];
            for (const prevSwapStatus of prevSwapStatuses) {
                payContext.setSwapStatus(prevSwapStatus as string);
                payContext.setSwapStatus(swapStatusPending.SwapCreated);
            }

            expect(mockGetSwapUTXOs).not.toHaveBeenCalled();
            expect(mockGetLockupTransaction).not.toHaveBeenCalled();
        },
    );

    test("should display RefundEta for claimed, non-expired swap with UTXOs", async () => {
        const timeoutEta = 1700000000;

        mockUseLocation.mockReturnValue({
            ...mockUseLocation(),
            state: { waitForSwapTimeout: true },
        } as ReturnType<typeof useLocation>);

        mockGetSwapUTXOs.mockResolvedValue([
            {
                id: "mock-tx-id-1",
                hex: "mock-utxo-hex-1",
                timeoutBlockHeight: 800000,
            },
            {
                id: "mock-tx-id-2",
                hex: "mock-utxo-hex-2",
                timeoutBlockHeight: 800000,
            },
        ]);
        mockGetLockupTransaction.mockResolvedValue({
            id: "lockup-tx-id",
            hex: "lockup-tx-hex",
            timeoutBlockHeight: 800000,
        });

        mockGetCurrentBlockHeight.mockResolvedValue({ "L-BTC": 799500 });
        mockGetTimeoutEta.mockReturnValue(timeoutEta);
        mockIsRefundableSwapType.mockReturnValue(true);
        mockHasSwapTimedOut.mockReturnValue(false);

        renderPay();

        payContext.setSwap({
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: { timeoutBlockHeight: 800000 },
        } as ChainSwap);

        payContext.setSwapStatus(swapStatusSuccess.TransactionClaimed);

        const refundEta = await screen.findByTestId("refund-eta");
        const expectedDate = new Date(timeoutEta * 1000).toLocaleString();
        expect(refundEta).toHaveTextContent(expectedDate);
    });

    test("should show post-bridge status link directly below completed message", async () => {
        const claimTx = "0xclaim";
        const postBridgeSwap = {
            id: "123",
            type: SwapType.Reverse,
            assetSend: BTC,
            assetReceive: USDT0,
            receiveAmount: 123_456,
            claimTx,
            bridge: {
                kind: "oft",
                sourceAsset: USDT0,
                destinationAsset: "USDT0-ETH",
                position: SwapPosition.Post,
            },
        } as ReverseSwap;

        swapsGetItemMock.mockResolvedValue(postBridgeSwap);
        mockGetSwapStatus.mockResolvedValue({
            status: swapStatusSuccess.TransactionClaimed,
        });
        renderPay();
        payContext.setSwap(postBridgeSwap);
        payContext.setSwapStatus(swapStatusSuccess.TransactionClaimed);

        const message = await screen.findByText(
            /Swap complete!.*was sent via the Ethereum bridge/u,
        );
        const bridgeLink = (await screen.findByText(
            dict.en.check_bridge_status,
        )) as HTMLAnchorElement;
        const newSwap = await screen.findByText(dict.en.new_swap);

        expect(
            message.compareDocumentPosition(bridgeLink) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            bridgeLink.compareDocumentPosition(newSwap) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(screen.getAllByText(dict.en.check_bridge_status)).toHaveLength(
            1,
        );
        expect(bridgeLink.href).toEqual(
            `${config.layerZeroExplorerUrl}/tx/${claimTx}`,
        );
    });

    test("should show refund button automatically when swap has timed out with UTXOs", async () => {
        mockGetSwapUTXOs.mockResolvedValue([
            {
                id: "mock-tx-id-1",
                hex: "mock-utxo-hex-1",
                timeoutBlockHeight: 800000,
            },
        ]);
        mockGetLockupTransaction.mockResolvedValue({
            id: "lockup-tx-id",
            hex: "lockup-tx-hex",
            timeoutBlockHeight: 800000,
        });

        mockGetCurrentBlockHeight.mockResolvedValue({ "L-BTC": 800001 });
        mockGetTimeoutEta.mockReturnValue(0);
        mockIsRefundableSwapType.mockReturnValue(true);
        mockHasSwapTimedOut.mockReturnValue(true);

        renderPay();

        payContext.setSwap({
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: { timeoutBlockHeight: 800000 },
        } as ChainSwap);

        payContext.setSwapStatus(swapStatusPending.TransactionConfirmed);

        const button = (await screen.findByTestId(
            "refundButton",
        )) as HTMLButtonElement;
        expect(button).toBeTruthy();
    });

    test("should update storage and pay context when claim was already broadcast externally", async () => {
        const swapFromStorage = {
            id: "123",
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            receiveAmount: 100_000,
            version: OutputType.Taproot,
            claimTx: undefined,
            lockupDetails: {},
        } as unknown as ChainSwap;

        swapsGetItemMock.mockResolvedValue(swapFromStorage);
        vi.mocked(isSwapClaimable).mockReturnValue(true);
        vi.mocked(claim).mockRejectedValue(
            "bad-txns-inputs-missingorspent: mocked rejection",
        );
        vi.mocked(findSwapOutputVout).mockReturnValue(0);
        vi.mocked(getTransactionOutSpend).mockResolvedValue({
            spent: true,
            txid: "already-claimed-txid",
        });

        renderPay();
        payContext.setSwap({ ...swapFromStorage });

        await payContext.claimSwap("123", {
            id: "123",
            status: swapStatusPending.TransactionMempool,
            transaction: {
                id: "lockup-txid",
                hex: "00",
            },
        });

        await waitFor(() => {
            expect(swapsSetItemMock).toHaveBeenCalledWith(
                "123",
                expect.objectContaining({
                    claimTx: "already-claimed-txid",
                }),
            );
            expect(payContext.swap()?.claimTx).toBe("already-claimed-txid");
        });
    });

    test("should still show claim failure when outspend lookup throws", async () => {
        const swapFromStorage = {
            id: "123",
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            receiveAmount: 100_000,
            version: OutputType.Taproot,
            claimTx: undefined,
            lockupDetails: {},
        } as unknown as ChainSwap;

        swapsGetItemMock.mockResolvedValue(swapFromStorage);
        vi.mocked(isSwapClaimable).mockReturnValue(true);
        vi.mocked(claim).mockRejectedValue(
            "bad-txns-inputs-missingorspent: mocked rejection",
        );
        vi.mocked(findSwapOutputVout).mockReturnValue(0);
        vi.mocked(getTransactionOutSpend).mockRejectedValue(
            new Error("network error"),
        );

        renderPay();
        payContext.setSwap({ ...swapFromStorage });

        await payContext.claimSwap("123", {
            id: "123",
            status: swapStatusPending.TransactionMempool,
            transaction: {
                id: "lockup-txid",
                hex: "00",
            },
        });

        await waitFor(() => {
            expect(globalSignals.notificationType()).toBe("error");
            expect(swapsSetItemMock).not.toHaveBeenCalledWith(
                "123",
                expect.objectContaining({ claimTx: expect.any(String) }),
            );
        });
    });

    test("reports isSwapClaiming while a claim is in flight and clears it once settled", async () => {
        const swapFromStorage = {
            id: "123",
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            receiveAmount: 100_000,
            version: OutputType.Taproot,
            claimTx: undefined,
            lockupDetails: {},
        } as unknown as ChainSwap;

        swapsGetItemMock.mockResolvedValue(swapFromStorage);
        vi.mocked(isSwapClaimable).mockReturnValue(true);

        let resolveClaim!: (value: ChainSwap | undefined) => void;
        vi.mocked(claim).mockReturnValue(
            new Promise<ChainSwap | undefined>((resolve) => {
                resolveClaim = resolve;
            }),
        );

        renderPay();
        payContext.setSwap({ ...swapFromStorage });

        expect(payContext.isSwapClaiming("123")).toBe(false);

        const claimPromise = payContext.claimSwap("123", {
            id: "123",
            status: swapStatusPending.TransactionMempool,
            transaction: {
                id: "lockup-txid",
                hex: "00",
            },
        });

        await waitFor(() => {
            expect(payContext.isSwapClaiming("123")).toBe(true);
        });

        resolveClaim(undefined);
        await claimPromise;

        await waitFor(() => {
            expect(payContext.isSwapClaiming("123")).toBe(false);
        });
    });

    test("clears isSwapClaiming after a claim rejects", async () => {
        const swapFromStorage = {
            id: "123",
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            receiveAmount: 100_000,
            version: OutputType.Taproot,
            claimTx: undefined,
            lockupDetails: {},
        } as unknown as ChainSwap;

        swapsGetItemMock.mockResolvedValue(swapFromStorage);
        vi.mocked(isSwapClaimable).mockReturnValue(true);
        vi.mocked(claim).mockRejectedValue(new Error("claim broadcast failed"));

        renderPay();
        payContext.setSwap({ ...swapFromStorage });

        await payContext.claimSwap("123", {
            id: "123",
            status: swapStatusPending.TransactionMempool,
            transaction: {
                id: "lockup-txid",
                hex: "00",
            },
        });

        await waitFor(() => {
            expect(globalSignals.notificationType()).toBe("error");
        });
        expect(payContext.isSwapClaiming("123")).toBe(false);
    });

    test("swaps the mempool view for the broadcasting view while the real claim signal is set", async () => {
        const swapFromStorage = {
            id: "123",
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            receiveAmount: 100_000,
            version: OutputType.Taproot,
            claimTx: undefined,
            lockupDetails: {},
        } as unknown as ChainSwap;

        swapsGetItemMock.mockResolvedValue(swapFromStorage);
        vi.mocked(isSwapClaimable).mockReturnValue(true);

        let resolveClaim!: (value: ChainSwap | undefined) => void;
        vi.mocked(claim).mockReturnValue(
            new Promise<ChainSwap | undefined>((resolve) => {
                resolveClaim = resolve;
            }),
        );

        const [swap] = createSignal<SomeSwap | null>(
            swapFromStorage as unknown as SomeSwap,
        );
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionMempool swap={swap} />
                </>
            ),
            { wrapper: contextWrapper },
        );

        await screen.findByText(dict.en.tx_in_mempool_subline);
        expect(screen.queryByText(dict.en.broadcasting_claim)).toBeNull();

        const claimPromise = payContext.claimSwap("123", {
            id: "123",
            status: swapStatusPending.TransactionMempool,
            transaction: {
                id: "lockup-txid",
                hex: "00",
            },
        });

        await screen.findByText(dict.en.broadcasting_claim);
        expect(screen.queryByText(dict.en.tx_in_mempool_subline)).toBeNull();

        resolveClaim(undefined);
        await claimPromise;

        await screen.findByText(dict.en.tx_in_mempool_subline);
        expect(screen.queryByText(dict.en.broadcasting_claim)).toBeNull();
    });
});
