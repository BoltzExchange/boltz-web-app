import { OutputType } from "boltz-core";
import { SwapType } from "boltz-swaps/types";

import { BTC, LBTC } from "../../src/consts/Assets";
import { swapStatusPending } from "../../src/consts/SwapStatus";
import type { SubmarineSwap } from "../../src/utils/swapCreator";
import { getCommitmentLockupDisplayStatus } from "../../src/utils/swapStatus";

const submarine = (overrides: Partial<SubmarineSwap> = {}) =>
    ({
        id: "swap-id",
        type: SwapType.Submarine,
        assetSend: LBTC,
        assetReceive: BTC,
        date: 1,
        version: OutputType.Taproot,
        invoice: "invoice",
        address: "address",
        sendAmount: 1,
        receiveAmount: 1,
        ...overrides,
    }) as SubmarineSwap;

describe("swapStatus utils", () => {
    test.each([swapStatusPending.SwapCreated, swapStatusPending.InvoiceSet])(
        "uses the commitment lockup display status for initial funding status %s",
        (status) => {
            expect(
                getCommitmentLockupDisplayStatus(
                    submarine({
                        commitmentLockup: true,
                        commitmentLockupTxHash: "0xcommitment",
                    }),
                    status,
                ),
            ).toEqual(swapStatusPending.TransactionMempool);
        },
    );

    test("preserves stored commitment lockup status", () => {
        expect(
            getCommitmentLockupDisplayStatus(
                submarine({
                    commitmentLockup: true,
                    commitmentLockupTxHash: "0xcommitment",
                    status: swapStatusPending.TransactionConfirmed,
                }),
                swapStatusPending.InvoiceSet,
            ),
        ).toEqual(swapStatusPending.TransactionConfirmed);
    });

    test("does not change swaps without a committed lockup", () => {
        expect(
            getCommitmentLockupDisplayStatus(
                submarine({ commitmentLockup: true }),
                swapStatusPending.InvoiceSet,
            ),
        ).toEqual(swapStatusPending.InvoiceSet);
    });
});
