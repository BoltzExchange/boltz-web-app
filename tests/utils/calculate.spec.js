import { setBoltzFee, setMinerFee, setReverse } from "../../src/signals";
import { calculateReceiveAmount, calculateSendAmount } from "../../src/utils/calculate";

describe('Calculate amounts', () => {
    describe('should calculate Swap amounts', () => {
        beforeAll(() => {
            setReverse(false);
            setMinerFee(147);
            setBoltzFee(0.1);
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
                    receiveAmount
                );
                expect(calculateSendAmount(receiveAmount)).toEqual(sendAmount);
            }
        );

        test('should return correct types', () => {
            expect(typeof calculateReceiveAmount(1000000)).toEqual('number');
            expect(typeof calculateSendAmount(1000000)).toEqual("number");
        });

        test('should not return negative numbers', () => {
            expect(calculateReceiveAmount(0)).toEqual(0);
        });
    });

    describe("should calculate Reverse Swap amounts", () => {
        beforeAll(() => {
            setReverse(true);
            setMinerFee(428);
            setBoltzFee(0.25);
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
                    receiveAmount
                );
                expect(calculateSendAmount(receiveAmount)).toEqual(sendAmount);
            }
        );

        test('should return correct types', () => {
            expect(typeof calculateReceiveAmount(1000000)).toEqual('number');
            expect(typeof calculateSendAmount(1000000)).toEqual("number");
        });

        test('should not return negative numbers', () => {
            expect(calculateReceiveAmount(0)).toEqual(0);
        });
    });
})
