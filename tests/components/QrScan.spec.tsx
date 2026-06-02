import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import QrScan from "../../src/components/QrScan";
import { BTC, LN } from "../../src/consts/Assets";
import Pair from "../../src/utils/Pair";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";

const qrScannerMock = vi.hoisted(() => ({
    destroy: vi.fn(),
    hasCamera: vi.fn(() => Promise.resolve(true)),
    scan: undefined as ((result: { data: string }) => void) | undefined,
    start: vi.fn(() => Promise.resolve()),
}));

vi.mock("qr-scanner", () => {
    const QrScanner = vi.fn().mockImplementation(function (_video, scan) {
        qrScannerMock.scan = scan;

        return {
            destroy: qrScannerMock.destroy,
            start: qrScannerMock.start,
        };
    });

    return {
        default: Object.assign(QrScanner, {
            hasCamera: qrScannerMock.hasCamera,
        }),
    };
});

afterEach(() => {
    localStorage.clear();
    qrScannerMock.destroy.mockClear();
    qrScannerMock.hasCamera.mockClear();
    qrScannerMock.scan = undefined;
    qrScannerMock.start.mockClear();
});

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(globalSignals.pairs(), fromAsset, toAsset));
};

describe("QrScan", () => {
    test("validates scanned onchain addresses", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <QrScan />
                </>
            ),
            { wrapper: contextWrapper },
        );
        setPairAssets(LN, BTC);

        fireEvent.click(
            await screen.findByText(globalSignals.t("scan_qr_code")),
        );

        await waitFor(() => {
            expect(qrScannerMock.start).toHaveBeenCalled();
        });

        const address = "bcrt1q7vq47xpsg4t080205edaulc3sdsjpdxy9svhr3";
        qrScannerMock.scan?.({ data: address });

        await waitFor(() => {
            expect(signals.addressValid()).toBe(true);
        });
        expect(signals.onchainAddress()).toEqual(address);
    });
});
