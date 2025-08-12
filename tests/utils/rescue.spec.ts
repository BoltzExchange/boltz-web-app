import { SwapType } from "../../src/consts/Enums";
import {
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/consts/SwapStatus";
import { isSwapClaimable } from "../../src/utils/rescue";

describe("rescue", () => {
    describe("isSwapClaimable", () => {
        test.each([
            {
                name: "Reverse: confirmed -> true",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionConfirmed,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Reverse: mempool -> true",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionMempool,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Reverse: success not included by default -> false",
                type: SwapType.Reverse,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Reverse: irrelevant status -> false",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionServerMempool,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Reverse: include success -> true",
                type: SwapType.Reverse,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: true,
                expected: true,
            },
        ])("$name", ({ type, status, includeSuccess, expected }) => {
            expect(isSwapClaimable({ status, type, includeSuccess })).toEqual(
                expected,
            );
        });

        test.each([
            {
                name: "Chain: server confirmed -> true",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerConfirmed,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Chain: server mempool -> true",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerMempool,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Chain: success not included by default -> false",
                type: SwapType.Chain,
                status: swapStatusSuccess.TransactionClaimed,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Chain: include success -> true",
                type: SwapType.Chain,
                status: swapStatusSuccess.TransactionClaimed,
                includeSuccess: true,
                expected: true,
            },
        ])("$name", ({ type, status, includeSuccess, expected }) => {
            expect(isSwapClaimable({ status, type, includeSuccess })).toEqual(
                expected,
            );
        });

        test.each([
            {
                name: "Submarine: confirmed -> false",
                type: SwapType.Submarine,
                status: swapStatusPending.TransactionConfirmed,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Submarine: success (includeSuccess=true) -> false",
                type: SwapType.Submarine,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: true,
                expected: false,
            },
        ])("$name", ({ type, status, includeSuccess, expected }) => {
            expect(isSwapClaimable({ status, type, includeSuccess })).toEqual(
                expected,
            );
        });

        test.each([
            { type: SwapType.Chain, includeSuccess: undefined },
            { type: SwapType.Chain, includeSuccess: false },
            { type: SwapType.Chain, includeSuccess: true },
            { type: SwapType.Reverse, includeSuccess: undefined },
            { type: SwapType.Reverse, includeSuccess: false },
            { type: SwapType.Reverse, includeSuccess: true },
            { type: SwapType.Submarine, includeSuccess: undefined },
            { type: SwapType.Submarine, includeSuccess: false },
            { type: SwapType.Submarine, includeSuccess: true },
        ])(
            "should return false for unknown statuses (type: $type, includeSuccess: $includeSuccess)",
            ({ type, includeSuccess }) => {
                expect(
                    isSwapClaimable({
                        status: "unknown.status",
                        type,
                        includeSuccess,
                    }),
                ).toEqual(false);
            },
        );
    });
});
