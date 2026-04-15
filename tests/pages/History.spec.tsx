import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";

import { BTC, LN } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import dict from "../../src/i18n/i18n";
import type { HistoryExport } from "../../src/pages/History";
import History from "../../src/pages/History";
import { latestStorageVersion } from "../../src/utils/migration";
import {
    GasAbstractionType,
    createUniformGasAbstraction,
} from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper } from "../helper";

const { downloadJsonMock, iterateStoreMock } = vi.hoisted(() => ({
    downloadJsonMock: vi.fn(),
    iterateStoreMock: vi.fn(),
}));

let storedSwaps: unknown[] = [];
let storedRdns: { address: string; rdns: string }[] = [];

vi.mock("../../src/utils/migration", async () => {
    const actual = await vi.importActual("../../src/utils/migration");
    return {
        ...actual,
        migrateStorage: vi.fn().mockResolvedValue(undefined),
    };
});

vi.mock("../../src/utils/download", async () => {
    const actual = await vi.importActual("../../src/utils/download");
    return {
        ...actual,
        downloadJson: downloadJsonMock,
        getExportFileName: vi.fn(() => "history-export"),
    };
});

vi.mock("localforage", () => ({
    default: {
        INDEXEDDB: "INDEXEDDB",
        LOCALSTORAGE: "LOCALSTORAGE",
        config: vi.fn(),
        createInstance: vi.fn((config?: { name?: string }) => ({
            getItem: vi.fn().mockResolvedValue(null),
            setItem: vi.fn().mockResolvedValue(undefined),
            removeItem: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
            keys: vi.fn().mockResolvedValue([]),
            iterate: vi.fn(
                (callback: (value: unknown, key: string) => void) => {
                    iterateStoreMock(config?.name, callback);
                },
            ),
        })),
    },
}));

const sampleSwap = {
    id: "swap-1",
    type: SwapType.Submarine,
    assetSend: BTC,
    assetReceive: LN,
    sendAmount: 1,
    receiveAmount: 1,
    version: 1,
    date: Date.now(),
    invoice: "lnbc1test",
    claimPrivateKeyIndex: 3,
    refundPrivateKeyIndex: 7,
    gasAbstraction: createUniformGasAbstraction(GasAbstractionType.None),
};

const renderHistory = () =>
    render(
        () => (
            <>
                <TestComponent />
                <History />
            </>
        ),
        {
            wrapper: contextWrapper,
        },
    );

describe("History", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        storedSwaps = [];
        storedRdns = [];
        iterateStoreMock.mockImplementation(
            (
                name: string | undefined,
                callback: (value: unknown, key: string) => void,
            ) => {
                if (name === "swaps") {
                    storedSwaps.forEach((swap, index) => {
                        callback(
                            swap,
                            (swap as { id?: string }).id ?? `swap-${index}`,
                        );
                    });
                    return;
                }

                if (name === "rdns") {
                    storedRdns.forEach((entry) => {
                        callback(entry.rdns, entry.address);
                    });
                }
            },
        );
    });

    test("should not show import actions when history is empty", async () => {
        renderHistory();

        expect(
            await screen.findByText(dict.en.history_no_swaps),
        ).toBeInTheDocument();
        expect(
            document.querySelector(
                'input[type="file"][accept="application/json"]',
            ),
        ).toBeNull();
    });

    test("should show export action for existing swaps", async () => {
        storedSwaps = [sampleSwap];

        renderHistory();

        expect(
            await screen.findByRole("button", {
                name: dict.en.history_export,
            }),
        ).toBeInTheDocument();
    });

    test("should export swaps without mnemonic or key indexes", async () => {
        const user = userEvent.setup();
        storedSwaps = [sampleSwap];
        storedRdns = [{ address: "0xabc", rdns: "wallet.example" }];

        renderHistory();

        await user.click(
            await screen.findByRole("button", {
                name: dict.en.history_export,
            }),
        );

        await waitFor(() => {
            expect(downloadJsonMock).toHaveBeenCalledOnce();
        });

        const exportPayload = downloadJsonMock.mock.calls[0]?.[1] as
            | HistoryExport
            | undefined;

        expect(downloadJsonMock).toHaveBeenCalledWith(
            "history-export",
            expect.any(Object),
        );
        expect(exportPayload).toBeDefined();
        expect(exportPayload).toMatchObject({
            version: latestStorageVersion,
            rdns: storedRdns,
        });
        expect(exportPayload).not.toHaveProperty("mnemonic");
        expect(exportPayload?.swaps[0]).toMatchObject({
            id: sampleSwap.id,
            assetSend: sampleSwap.assetSend,
            assetReceive: sampleSwap.assetReceive,
        });
    });
});
