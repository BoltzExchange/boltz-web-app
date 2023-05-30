import { BigNumber } from "bignumber.js";
import { boltzFee, minerFee, reverse } from "../signals";

const bigRound = (big) => {
    return big.integerValue(BigNumber.ROUND_CEIL);
};

export const calculateReceiveAmount = (sendAmount) => {
    const receiveAmount = reverse()
        ? BigNumber(sendAmount)
              .minus(bigRound(BigNumber(sendAmount).times(boltzFee()).div(100)))
              .minus(minerFee())
        : BigNumber(sendAmount)
              .minus(minerFee())
              .div(BigNumber(1).plus(BigNumber(boltzFee()).div(100)));
    return Math.max(Math.floor(receiveAmount.toNumber()), 0);
};

export const calculateSendAmount = (receiveAmount) => {
    return reverse()
        ? Math.ceil(
              BigNumber(receiveAmount)
                  .plus(minerFee())
                  .div(BigNumber(1).minus(BigNumber(boltzFee()).div(100)))
                  .toNumber()
          )
        : Math.floor(
              BigNumber(receiveAmount)
                  .plus(
                      bigRound(
                          BigNumber(receiveAmount).times(
                              BigNumber(boltzFee()).div(100)
                          )
                      )
                  )
                  .plus(minerFee())
                  .toNumber()
          );
};
