import { render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { SwapPosition } from "boltz-swaps/types";
import type { Hash, PublicClient, TransactionReceipt } from "viem";

import { config } from "../../src/config";
import { USDT0 } from "../../src/consts/Assets";
import { InvoiceValidation } from "../../src/consts/Enums";
import dict from "../../src/i18n/i18n";
import {
    type CommitmentAmounts,
    CommitmentLockupTransaction,
    calculateCommittedSubmarineAmounts,
    validateCommitmentInvoice,
    validateCommitmentInvoiceInput,
    waitForCommitmentLockupReceipt,
} from "../../src/status/CommitmentCreated";
import type Pair from "../../src/utils/Pair";
import type { BridgeDetail } from "../../src/utils/swapCreator";
import { validateInvoice } from "../../src/utils/validation";
import { contextWrapper } from "../helper";

const invoice = "lnbcrt1mock";
const invoiceSats = 40_720;

vi.mock("../../src/utils/validation", async () => {
    const actual = await vi.importActual("../../src/utils/validation");
    const validateInvoice = vi.fn((input: string) => {
        if (input === invoice) {
            return invoiceSats;
        }
        throw new Error("invalid_invoice");
    });

    return {
        ...actual,
        validateInvoice,
    };
});

describe("CommitmentCreated", () => {
    const bolt12Offer =
        "lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c";

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const commitmentAmountsForInvoice = (
        invoiceValue: string,
    ): CommitmentAmounts =>
        commitmentAmountsForSats(validateInvoice(invoiceValue));

    const commitmentAmountsForSats = (sats: number): CommitmentAmounts => ({
        pairHash: "pair-hash",
        sendAmount: BigNumber(sats + 2),
        receiveAmount: BigNumber(sats),
    });

    test("uses invoice-derived submarine send amount and fresh pair hash after commitment lockup", async () => {
        const directPair = {
            minerFees: 0,
            calculateReceiveAmount: vi.fn().mockResolvedValue(BigNumber(2614)),
            calculateSendAmount: vi.fn().mockResolvedValue(BigNumber(2614)),
            creationData: vi.fn().mockResolvedValue({
                pairHash: "fresh-pair-hash",
            }),
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
        expect(directPair.creationData).toHaveBeenCalledWith(
            BigNumber(2614),
            0,
        );
        expect(amounts.sendAmount).toEqual(BigNumber(2614));
        expect(amounts.receiveAmount).toEqual(BigNumber(2614));
        expect(amounts.pairHash).toEqual("fresh-pair-hash");
    });

    test("accepts BIP21 invoices like the create page invoice input", () => {
        const amounts = commitmentAmountsForInvoice(invoice);

        expect(
            validateCommitmentInvoice(`bitcoin:?lightning=${invoice}`, amounts),
        ).toEqual({
            invoice,
            sats: validateInvoice(invoice),
        });
    });

    test("accepts deferred invoice inputs", () => {
        vi.mocked(validateInvoice).mockClear();

        expect(
            validateCommitmentInvoiceInput(
                `bitcoin:?lno=${bolt12Offer}`,
                commitmentAmountsForSats(invoiceSats),
            ),
        ).toEqual({
            invoice: bolt12Offer,
            originalDestination: bolt12Offer,
            sats: invoiceSats,
        });
        expect(validateInvoice).not.toHaveBeenCalled();
    });

    test("rejects invoices with the wrong amount and reports the expected amount", () => {
        const expectedSats = validateInvoice(invoice) + 1;

        let thrown: unknown;
        try {
            validateCommitmentInvoice(`lightning:${invoice}`, {
                ...commitmentAmountsForInvoice(invoice),
                receiveAmount: BigNumber(expectedSats),
            });
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toEqual(
            InvoiceValidation.ExactAmount,
        );
        // The expected amount is carried on the cause so the UI can render it
        expect((thrown as Error).cause).toEqual(expectedSats);
    });

    test("retries commitment lockup receipt lookup after transient failures", async () => {
        const hash = `0x${"1".repeat(64)}` as Hash;
        const receipt = { blockNumber: 123n } as TransactionReceipt;
        const provider = {
            waitForTransactionReceipt: vi
                .fn()
                .mockRejectedValueOnce(new Error("temporary rpc failure"))
                .mockResolvedValueOnce(receipt),
        } as unknown as PublicClient;

        await expect(
            waitForCommitmentLockupReceipt(provider, hash, 1, 0),
        ).resolves.toBe(receipt);
        expect(provider.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
        expect(provider.waitForTransactionReceipt).toHaveBeenCalledWith({
            hash,
            confirmations: 1,
            timeout: 1,
        });
    });

    test("stops commitment lockup receipt lookup after the configured attempts", async () => {
        const hash = `0x${"1".repeat(64)}` as Hash;
        const provider = {
            waitForTransactionReceipt: vi
                .fn()
                .mockRejectedValue(new Error("rpc timeout")),
        } as unknown as PublicClient;

        await expect(
            waitForCommitmentLockupReceipt(provider, hash, 1, 0, 2),
        ).rejects.toThrow("rpc timeout");
        expect(provider.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
    });

    describe("CommitmentLockupTransaction", () => {
        const txHash = "0xdeadbeef";
        const lockupTransactionLabel = dict.en.blockexplorer.replace(
            "{{ typeLabel }}",
            dict.en.blockexplorer_lockup_tx,
        );
        const preBridge = {
            kind: "oft",
            sourceAsset: "USDT0-ETH",
            destinationAsset: USDT0,
            position: SwapPosition.Pre,
        } as unknown as BridgeDetail;

        const explorerTxHref = () =>
            `${config.assets![USDT0].blockExplorerUrl!.normal}/tx/${txHash}`;

        test("labels the link as bridge status for bridged commitments", async () => {
            render(
                () => (
                    <CommitmentLockupTransaction
                        asset={USDT0}
                        txHash={txHash}
                        bridge={preBridge}
                    />
                ),
                { wrapper: contextWrapper },
            );

            const link = (
                await screen.findByText(dict.en.check_bridge_status)
            ).closest("a")!;

            expect(screen.queryByText(lockupTransactionLabel)).toBeNull();
            expect(link.getAttribute("aria-label")).toEqual(
                dict.en.check_bridge_status,
            );
            expect(link.href).toEqual(explorerTxHref());
        });

        test("keeps the lockup transaction label for non-bridged commitments", async () => {
            render(
                () => (
                    <CommitmentLockupTransaction
                        asset={USDT0}
                        txHash={txHash}
                    />
                ),
                { wrapper: contextWrapper },
            );

            const link = (
                await screen.findByText(lockupTransactionLabel)
            ).closest("a")!;

            expect(screen.queryByText(dict.en.check_bridge_status)).toBeNull();
            expect(link.getAttribute("aria-label")).toEqual(
                lockupTransactionLabel,
            );
            expect(link.href).toEqual(explorerTxHref());
        });
    });
});
