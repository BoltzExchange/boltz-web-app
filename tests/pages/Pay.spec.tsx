import type * as SolidRouter from "@solidjs/router";
import { useLocation } from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";

import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/consts/SwapStatus";
import dict from "../../src/i18n/i18n";
import Pay from "../../src/pages/Pay";
import {
    getSwapUTXOs,
    getTransactionOutSpend,
} from "../../src/utils/blockchain";
import {
    getLockupTransaction,
    getSwapStatus,
} from "../../src/utils/boltzClient";
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
import { TestComponent } from "../helper";
import { contextWrapper, globalSignals, payContext } from "../helper";

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
        methodFactory: vi.fn(),
    },
}));

vi.mock("../../src/utils/boltzClient", () => ({
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
vi.mock("../../src/utils/compat", async () => {
    const actual = await vi.importActual("../../src/utils/compat");
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
        swapsGetItemMock.mockResolvedValue({
            id: "123",
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: {},
        });
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
                payContext.setSwapStatus(prevSwapStatus);
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
});
