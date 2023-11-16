import {
    minerFee,
    setBoltzFee,
    setMinerFee,
    setReverse,
} from "../../src/signals";
import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "../../src/utils/calculate";
import { BigNumber } from "bignumber.js";

describe("Calculate amounts", () => {
    const setSwapFees = () => {
        setReverse(false);
        setMinerFee(147);
        setBoltzFee(0.1);
    };

    const setReverseSwapFees = () => {
        setReverse(true);
        setMinerFee(428);
        setBoltzFee(0.25);
    };

    describe("should calculate Swap amounts", () => {
        beforeAll(() => {
            setSwapFees();
        });

        test.each`
            sendAmount | receiveAmount
            ${10157}   | ${10000}
            ${12473}   | ${12313}
            ${4299409} | ${4294967}
            ${62531}   | ${62321}
        `(
            "calculate amounts $sendAmount <-> $receiveAmount",
            ({ sendAmount, receiveAmount }) => {
                expect(calculateReceiveAmount(sendAmount)).toEqual(
                    receiveAmount,
                );
                expect(calculateSendAmount(receiveAmount)).toEqual(sendAmount);
            },
        );

        test("should return correct types", () => {
            expect(typeof calculateReceiveAmount(1000000)).toEqual("number");
            expect(typeof calculateSendAmount(1000000)).toEqual("number");
        });

        test("should not return negative numbers", () => {
            expect(calculateReceiveAmount(0)).toEqual(0);
        });
    });

    describe("should calculate Reverse Swap amounts", () => {
        beforeAll(() => {
            setReverseSwapFees();
        });

        test.each`
            sendAmount | receiveAmount
            ${1000000} | ${997072}
            ${10000}   | ${9547}
            ${122344}  | ${121610}
            ${4294967} | ${4283801}
        `(
            "calculate amounts $sendAmount <-> $receiveAmount",
            ({ sendAmount, receiveAmount }) => {
                expect(calculateReceiveAmount(sendAmount)).toEqual(
                    receiveAmount,
                );
                expect(calculateSendAmount(receiveAmount)).toEqual(sendAmount);
            },
        );

        test("should return correct types", () => {
            expect(typeof calculateReceiveAmount(1000000)).toEqual("number");
            expect(typeof calculateSendAmount(1000000)).toEqual("number");
        });

        test("should not return negative numbers", () => {
            expect(calculateReceiveAmount(0)).toEqual(0);
        });
    });

    describe("should calculate Boltz fee based on send amount", () => {
        test.each`
            sendAmount | receiveAmount | fee
            ${10157}   | ${10000}      | ${10}
            ${12473}   | ${12313}      | ${13}
            ${4299409} | ${4294967}    | ${4295}
            ${62531}   | ${62321}      | ${63}
            ${100}     | ${-47}        | ${0}
        `(
            "should calculate fee for Swaps $sendAmount -> $fee",
            ({ sendAmount, receiveAmount, fee }) => {
                setSwapFees();

                expect(calculateBoltzFeeOnSend(sendAmount)).toEqual(fee);
                expect(
                    BigNumber(sendAmount)
                        .minus(calculateBoltzFeeOnSend(sendAmount))
                        .minus(minerFee())
                        .toNumber(),
                ).toEqual(receiveAmount);
            },
        );

        test.each`
            sendAmount | receiveAmount | fee
            ${1000000} | ${997072}     | ${2500}
            ${10000}   | ${9547}       | ${25}
            ${122344}  | ${121610}     | ${306}
            ${4294967} | ${4283801}    | ${10738}
        `(
            "should calculate fee for Reverse Swaps $sendAmount -> $fee",
            ({ sendAmount, receiveAmount, fee }) => {
                setReverseSwapFees();

                expect(calculateBoltzFeeOnSend(sendAmount)).toEqual(fee);
                expect(
                    BigNumber(sendAmount)
                        .minus(calculateBoltzFeeOnSend(sendAmount))
                        .minus(minerFee())
                        .toNumber(),
                ).toEqual(receiveAmount);
            },
        );

        test("should calculate negative fees", () => {
            setSwapFees();
            setBoltzFee(-0.1);
            expect(calculateBoltzFeeOnSend(1_000_000)).toEqual(-1000);
        });

        test("should return correct types", () => {
            setReverse(true);
            expect(typeof calculateBoltzFeeOnSend(1000000)).toEqual("number");

            setReverse(false);
            expect(typeof calculateBoltzFeeOnSend(1000000)).toEqual("number");
        });
    });
});
