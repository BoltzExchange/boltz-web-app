import { BigNumber } from "bignumber.js";
import bolt11 from "bolt11";

import {
    type CommitmentAmounts,
    calculateCommittedSubmarineAmounts,
    validateCommitmentInvoice,
    validateCommitmentInvoiceInput,
} from "../../src/status/CommitmentCreated";
import type Pair from "../../src/utils/Pair";
import { validateInvoice } from "../../src/utils/validation";

vi.mock("../../src/utils/invoice", async () => {
    const actual = await vi.importActual("../../src/utils/invoice");
    return {
        ...actual,
        isBolt12Offer: vi.fn((offer: string) => offer.startsWith("lno1")),
    };
});

describe("CommitmentCreated", () => {
    const invoice = "lnbcrt1mock";
    const invoiceSats = 40_720;
    const bolt12Offer =
        "lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c";

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockInvoiceDecode = () => {
        vi.spyOn(bolt11, "decode").mockReturnValue({
            millisatoshis: (invoiceSats * 1_000).toString(),
            tags: [
                {
                    tagName: "payment_hash",
                    data: "mock_hash",
                },
            ],
        } as ReturnType<typeof bolt11.decode>);
    };

    const commitmentAmountsForInvoice = (
        invoiceValue: string,
    ): CommitmentAmounts =>
        commitmentAmountsForSats(validateInvoice(invoiceValue));

    const commitmentAmountsForSats = (sats: number): CommitmentAmounts => ({
        boltzFee: BigNumber(1),
        lockupAmount: BigNumber(sats + 1),
        networkFee: BigNumber(1),
        sendAmount: BigNumber(sats + 2),
        receiveAmount: BigNumber(sats),
    });

    test("uses invoice-derived submarine send amount after commitment lockup", async () => {
        const directPair = {
            minerFees: 0,
            feeOnSend: vi.fn().mockReturnValue(BigNumber(1)),
            calculateReceiveAmount: vi.fn().mockResolvedValue(BigNumber(2614)),
            calculateSendAmount: vi.fn().mockResolvedValue(BigNumber(2614)),
        } as unknown as Pair;

        const amounts = await calculateCommittedSubmarineAmounts(
            directPair,
            BigNumber(2615),
        );

        expect(directPair.calculateReceiveAmount).toHaveBeenCalledWith(
            BigNumber(2615),
            0,
        );
        expect(directPair.calculateSendAmount).toHaveBeenCalledWith(
            BigNumber(2614),
            0,
        );
        expect(directPair.feeOnSend).toHaveBeenCalledWith(BigNumber(2614));
        expect(amounts.boltzFee).toEqual(BigNumber(1));
        expect(amounts.lockupAmount).toEqual(BigNumber(2615));
        expect(amounts.networkFee).toEqual(BigNumber(0));
        expect(amounts.sendAmount).toEqual(BigNumber(2614));
        expect(amounts.receiveAmount).toEqual(BigNumber(2614));
    });

    test("accepts lightning-prefixed invoices", () => {
        mockInvoiceDecode();
        const amounts = commitmentAmountsForInvoice(invoice);

        expect(
            validateCommitmentInvoice(`lightning:${invoice}`, amounts),
        ).toEqual({
            invoice,
            sats: validateInvoice(invoice),
        });
    });

    test("accepts BIP21 invoices like the create page invoice input", () => {
        mockInvoiceDecode();
        const amounts = commitmentAmountsForInvoice(invoice);

        expect(
            validateCommitmentInvoice(`bitcoin:?lightning=${invoice}`, amounts),
        ).toEqual({
            invoice,
            sats: validateInvoice(invoice),
        });
    });

    test.each`
        type              | input                            | expected
        ${"LNURL"}        | ${"user@example.com"}            | ${"user@example.com"}
        ${"BOLT12"}       | ${bolt12Offer}                   | ${bolt12Offer}
        ${"BIP21 BOLT12"} | ${`bitcoin:?lno=${bolt12Offer}`} | ${bolt12Offer}
    `(
        "accepts $type inputs for deferred invoice fetch",
        ({ input, expected }) => {
            expect(
                validateCommitmentInvoiceInput(
                    input,
                    commitmentAmountsForSats(invoiceSats),
                ),
            ).toEqual({
                invoice: expected,
                originalDestination: expected,
                sats: invoiceSats,
            });
        },
    );

    test("rejects amountless invoices", () => {
        vi.spyOn(bolt11, "decode").mockReturnValue({
            millisatoshis: "0",
            tags: [
                {
                    tagName: "payment_hash",
                    data: "mock_hash",
                },
            ],
        } as ReturnType<typeof bolt11.decode>);

        expect(() =>
            validateCommitmentInvoice(invoice, {
                boltzFee: BigNumber(1),
                lockupAmount: BigNumber(1),
                networkFee: BigNumber(1),
                sendAmount: BigNumber(1),
                receiveAmount: BigNumber(0),
            }),
        ).toThrow("invalid_0_amount");
    });

    test("rejects invoices with the wrong amount", () => {
        mockInvoiceDecode();

        expect(() =>
            validateCommitmentInvoice(`lightning:${invoice}`, {
                ...commitmentAmountsForInvoice(invoice),
                receiveAmount: BigNumber(validateInvoice(invoice) + 1),
            }),
        ).toThrow("invalid_invoice");
    });
});
