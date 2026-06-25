import { decodeInvoice } from "boltz-swaps/invoice";
import { vi } from "vitest";

import { validateInvoice } from "../../src/utils/validation";

vi.mock("boltz-swaps/invoice", async () => ({
    ...(await vi.importActual("boltz-swaps/invoice")),
    decodeInvoice: vi.fn(),
}));

vi.mock("../../src/utils/invoice", async () => ({
    ...(await vi.importActual("../../src/utils/invoice")),
    isInvoice: vi.fn(() => true),
    isLnurl: vi.fn(() => false),
}));

const decodeInvoiceMock = vi.mocked(decodeInvoice);

describe("validateInvoice", () => {
    beforeEach(() => {
        decodeInvoiceMock.mockReset();
    });

    test.each([
        "invalid invoice",
        "invalid bolt12 invoice",
        "missing bolt11 payment hash",
        "missing bolt12 payment hash",
    ])(
        "maps SDK decode error %p to the invalid_invoice i18n key",
        (sdkError) => {
            decodeInvoiceMock.mockImplementation(() => {
                throw new Error(sdkError);
            });

            expect(() => validateInvoice("lnbcrt1corrupt")).toThrow(
                "invalid_invoice",
            );
        },
    );

    test("throws invalid_0_amount for a zero-amount invoice", () => {
        decodeInvoiceMock.mockReturnValue({ satoshis: 0 } as never);

        expect(() => validateInvoice("lnbcrt1zeroamount")).toThrow(
            "invalid_0_amount",
        );
    });

    test("returns the decoded amount for a valid invoice", () => {
        decodeInvoiceMock.mockReturnValue({ satoshis: 1000 } as never);

        expect(validateInvoice("lnbcrt1valid")).toBe(1000);
    });
});
