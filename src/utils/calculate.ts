import { BigNumber } from "bignumber.js";

import { boltzFee, minerFee, reverse } from "../signals";

const bigRound = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_CEIL);
};

export const calculateReceiveAmount = (sendAmount: number): number => {
    const receiveAmount = reverse()
        ? BigNumber(sendAmount)
              .minus(bigRound(BigNumber(sendAmount).times(boltzFee()).div(100)))
              .minus(minerFee())
        : BigNumber(sendAmount)
              .minus(minerFee())
              .div(BigNumber(1).plus(BigNumber(boltzFee()).div(100)));
    return Math.max(Math.floor(receiveAmount.toNumber()), 0);
};

export const calculateBoltzFeeOnSend = (sendAmount: BigNumber): number => {
    let fee: BigNumber;

    if (reverse()) {
        fee = bigRound(sendAmount.times(boltzFee()).div(100));
    } else {
        fee = sendAmount
            .minus(calculateReceiveAmount(sendAmount.toNumber()))
            .minus(minerFee());

        if (sendAmount.toNumber() < minerFee()) {
            fee = BigNumber(0);
        }
    }

    return Math.ceil(fee.toNumber());
};

export const calculateSendAmount = (receiveAmount: number): number => {
    return reverse()
        ? Math.ceil(
              BigNumber(receiveAmount)
                  .plus(minerFee())
                  .div(BigNumber(1).minus(BigNumber(boltzFee()).div(100)))
                  .toNumber(),
          )
        : Math.floor(
              BigNumber(receiveAmount)
                  .plus(
                      bigRound(
                          BigNumber(receiveAmount).times(
                              BigNumber(boltzFee()).div(100),
                          ),
                      ),
                  )
                  .plus(minerFee())
                  .toNumber(),
          );
};
