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
                100_000,
                boltzFee,
                minerFee,
                type,
            );
            expect(recv).toBeGreaterThan(0);
            expect(Number.isInteger(recv)).toBe(true);
        });

        test("returns 0 when send is less than miner fee", () => {
            expect(calculateReceiveAmount(100, boltzFee, 500, type)).toBe(0);
        });

        test("returns 0 for zero send", () => {
            expect(calculateReceiveAmount(0, boltzFee, minerFee, type)).toBe(0);
        });
    });

    describe("Reverse (LN → on-chain)", () => {
        const type = SwapType.Reverse;

        test("typical amount", () => {
            const recv = calculateReceiveAmount(
                100_000,
                boltzFee,
                minerFee,
                type,
            );
            expect(recv).toBeGreaterThan(0);
            expect(Number.isInteger(recv)).toBe(true);
        });

        test("returns 0 when fees exceed send", () => {
            expect(calculateReceiveAmount(100, 50, 200, type)).toBe(0);
        });

        test("returns 0 for zero send", () => {
            expect(calculateReceiveAmount(0, boltzFee, minerFee, type)).toBe(0);
        });
    });

    describe("Chain (on-chain → on-chain)", () => {
        const type = SwapType.Chain;

        test("uses same formula as Reverse", () => {
            const a = calculateReceiveAmount(
                100_000,
                boltzFee,
                minerFee,
                SwapType.Reverse,
            );
            const b = calculateReceiveAmount(100_000, boltzFee, minerFee, type);
            expect(a).toBe(b);
        });
    });

    test("never returns negative", () => {
        for (const type of [
            SwapType.Submarine,
            SwapType.Reverse,
            SwapType.Chain,
        ]) {
            expect(calculateReceiveAmount(1, 99, 9999, type)).toBe(0);
        }
    });

    test("NaN send propagates NaN", () => {
        expect(
            calculateReceiveAmount(NaN, boltzFee, minerFee, SwapType.Submarine),
        ).toBeNaN();
    });
});

describe("calculateBoltzFeeOnSend", () => {
    const boltzFee = 0.1;
    const minerFee = 300;

    describe("Reverse / Chain", () => {
        const type = SwapType.Reverse;

        test("fee is ceil of percentage", () => {
            const fee = calculateBoltzFeeOnSend(
                100_000,
                boltzFee,
                minerFee,
                type,
            );
            expect(fee).toBe(Math.ceil((100_000 * boltzFee) / 100));
        });

        test("fee for 1 sat is 1 (ceiling)", () => {
            expect(calculateBoltzFeeOnSend(1, boltzFee, minerFee, type)).toBe(
                1,
            );
        });
    });

    describe("Submarine", () => {
        const type = SwapType.Submarine;

        test("fee + minerFee + receive = send", () => {
            const send = 100_000;
            const fee = calculateBoltzFeeOnSend(send, boltzFee, minerFee, type);
            const recv = calculateReceiveAmount(send, boltzFee, minerFee, type);
            expect(fee + minerFee + recv).toBe(send);
        });

        test("fee is 0 when send < minerFee", () => {
            expect(calculateBoltzFeeOnSend(100, boltzFee, 500, type)).toBe(0);
        });
    });

    test("NaN send returns 0", () => {
        expect(
            calculateBoltzFeeOnSend(NaN, boltzFee, minerFee, SwapType.Reverse),
        ).toBe(0);
    });

    test("zero send returns 0", () => {
        expect(
            calculateBoltzFeeOnSend(0, boltzFee, minerFee, SwapType.Submarine),
        ).toBe(0);
    });
});

describe("calculateSendAmount", () => {
    const boltzFee = 0.1;
    const minerFee = 300;

    test("is inverse of calculateReceiveAmount for Reverse", () => {
        const type = SwapType.Reverse;
        const send = 100_000;
        const recv = calculateReceiveAmount(send, boltzFee, minerFee, type);
        const roundTrip = calculateSendAmount(recv, boltzFee, minerFee, type);
        // Due to rounding (ceil/floor), roundTrip may differ by at most 1
        expect(Math.abs(roundTrip - send)).toBeLessThanOrEqual(1);
    });

    test("is inverse of calculateReceiveAmount for Submarine", () => {
        const type = SwapType.Submarine;
        const send = 100_000;
        const recv = calculateReceiveAmount(send, boltzFee, minerFee, type);
        const roundTrip = calculateSendAmount(recv, boltzFee, minerFee, type);
        expect(Math.abs(roundTrip - send)).toBeLessThanOrEqual(1);
    });

    test("zero receive returns minerFee region", () => {
        const type = SwapType.Reverse;
        const result = calculateSendAmount(0, boltzFee, minerFee, type);
        expect(result).toBeGreaterThanOrEqual(minerFee);
    });

    test("large amount stays consistent", () => {
        const type = SwapType.Chain;
        const recv = 21_000_000 * 100_000_000; // 21M BTC in sats
        const send = calculateSendAmount(recv, boltzFee, minerFee, type);
        expect(send).toBeGreaterThan(recv);
    });
});
