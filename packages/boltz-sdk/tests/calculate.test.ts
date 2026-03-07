import { BigNumber } from "bignumber.js";

import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "../src/public/calculate";
import { SwapType } from "../src/public/enums";

describe("calculateReceiveAmount", () => {
    const boltzFee = 0.1; // 0.1%
    const minerFee = 300;

    describe("Submarine (on-chain → LN)", () => {
        const type = SwapType.Submarine;

        test("typical amount", () => {
            const recv = calculateReceiveAmount(
                BigNumber(100_000),
                boltzFee,
                minerFee,
                type,
            );
            expect(recv.toNumber()).toBeGreaterThan(0);
            expect(recv.isInteger()).toBe(true);
        });

        test("returns 0 when send is less than miner fee", () => {
            expect(
                calculateReceiveAmount(
                    BigNumber(100),
                    boltzFee,
                    500,
                    type,
                ).toNumber(),
            ).toBe(0);
        });

        test("returns 0 for zero send", () => {
            expect(
                calculateReceiveAmount(
                    BigNumber(0),
                    boltzFee,
                    minerFee,
                    type,
                ).toNumber(),
            ).toBe(0);
        });
    });

    describe("Reverse (LN → on-chain)", () => {
        const type = SwapType.Reverse;

        test("typical amount", () => {
            const recv = calculateReceiveAmount(
                BigNumber(100_000),
                boltzFee,
                minerFee,
                type,
            );
            expect(recv.toNumber()).toBeGreaterThan(0);
            expect(recv.isInteger()).toBe(true);
        });

        test("returns 0 when fees exceed send", () => {
            expect(
                calculateReceiveAmount(
                    BigNumber(100),
                    50,
                    200,
                    type,
                ).toNumber(),
            ).toBe(0);
        });

        test("returns 0 for zero send", () => {
            expect(
                calculateReceiveAmount(
                    BigNumber(0),
                    boltzFee,
                    minerFee,
                    type,
                ).toNumber(),
            ).toBe(0);
        });
    });

    describe("Chain (on-chain → on-chain)", () => {
        const type = SwapType.Chain;

        test("uses same formula as Reverse", () => {
            const a = calculateReceiveAmount(
                BigNumber(100_000),
                boltzFee,
                minerFee,
                SwapType.Reverse,
            );
            const b = calculateReceiveAmount(
                BigNumber(100_000),
                boltzFee,
                minerFee,
                type,
            );
            expect(a.toNumber()).toBe(b.toNumber());
        });
    });

    test("never returns negative", () => {
        for (const type of [
            SwapType.Submarine,
            SwapType.Reverse,
            SwapType.Chain,
        ]) {
            expect(
                calculateReceiveAmount(
                    BigNumber(1),
                    99,
                    9999,
                    type,
                ).toNumber(),
            ).toBe(0);
        }
    });

    test("NaN send propagates NaN", () => {
        expect(
            calculateReceiveAmount(
                BigNumber(NaN),
                boltzFee,
                minerFee,
                SwapType.Submarine,
            ).isNaN(),
        ).toBe(true);
    });
});

describe("calculateBoltzFeeOnSend", () => {
    const boltzFee = 0.1;
    const minerFee = 300;

    describe("Reverse / Chain", () => {
        const type = SwapType.Reverse;

        test("fee is ceil of percentage", () => {
            const fee = calculateBoltzFeeOnSend(
                BigNumber(100_000),
                boltzFee,
                minerFee,
                type,
            );
            expect(fee.toNumber()).toBe(
                Math.ceil((100_000 * boltzFee) / 100),
            );
        });

        test("fee for 1 sat is 1 (ceiling)", () => {
            expect(
                calculateBoltzFeeOnSend(
                    BigNumber(1),
                    boltzFee,
                    minerFee,
                    type,
                ).toNumber(),
            ).toBe(1);
        });
    });

    describe("Submarine", () => {
        const type = SwapType.Submarine;

        test("fee + minerFee + receive = send", () => {
            const send = BigNumber(100_000);
            const fee = calculateBoltzFeeOnSend(send, boltzFee, minerFee, type);
            const recv = calculateReceiveAmount(
                send,
                boltzFee,
                minerFee,
                type,
            );
            expect(fee.plus(minerFee).plus(recv).toNumber()).toBe(
                send.toNumber(),
            );
        });

        test("fee is 0 when send < minerFee", () => {
            expect(
                calculateBoltzFeeOnSend(
                    BigNumber(100),
                    boltzFee,
                    500,
                    type,
                ).toNumber(),
            ).toBe(0);
        });
    });

    test("NaN send returns 0", () => {
        expect(
            calculateBoltzFeeOnSend(
                BigNumber(NaN),
                boltzFee,
                minerFee,
                SwapType.Reverse,
            ).toNumber(),
        ).toBe(0);
    });

    test("zero send returns 0", () => {
        expect(
            calculateBoltzFeeOnSend(
                BigNumber(0),
                boltzFee,
                minerFee,
                SwapType.Submarine,
            ).toNumber(),
        ).toBe(0);
    });
});

describe("calculateSendAmount", () => {
    const boltzFee = 0.1;
    const minerFee = 300;

    test("is inverse of calculateReceiveAmount for Reverse", () => {
        const type = SwapType.Reverse;
        const send = BigNumber(100_000);
        const recv = calculateReceiveAmount(send, boltzFee, minerFee, type);
        const roundTrip = calculateSendAmount(recv, boltzFee, minerFee, type);
        expect(
            Math.abs(roundTrip.toNumber() - send.toNumber()),
        ).toBeLessThanOrEqual(1);
    });

    test("is inverse of calculateReceiveAmount for Submarine", () => {
        const type = SwapType.Submarine;
        const send = BigNumber(100_000);
        const recv = calculateReceiveAmount(send, boltzFee, minerFee, type);
        const roundTrip = calculateSendAmount(recv, boltzFee, minerFee, type);
        expect(
            Math.abs(roundTrip.toNumber() - send.toNumber()),
        ).toBeLessThanOrEqual(1);
    });

    test("zero receive returns minerFee region", () => {
        const type = SwapType.Reverse;
        const result = calculateSendAmount(
            BigNumber(0),
            boltzFee,
            minerFee,
            type,
        );
        expect(result.toNumber()).toBeGreaterThanOrEqual(minerFee);
    });

    test("large amount stays consistent", () => {
        const type = SwapType.Chain;
        const recv = BigNumber(21_000_000).times(100_000_000);
        const send = calculateSendAmount(recv, boltzFee, minerFee, type);
        expect(send.toNumber()).toBeGreaterThan(recv.toNumber());
    });
});
