import { BTC } from "../consts.js";
import { config, asset } from "../signals.js";

const relevantMinerFees = (minerFees) => {
    return asset() === BTC ? minerFees.quoteAsset : minerFees.baseAsset;
};

export const feeChecker = (pairs) => {
    const fees = pairs[`${asset()}/${BTC}`].fees;
    const feesOld = config()[`${asset()}/${BTC}`].fees;

    return (
        JSON.stringify(relevantMinerFees(feesOld.minerFees)) ===
            JSON.stringify(relevantMinerFees(fees.minerFees)) &&
        ["percentage", "percentageSwapIn"].every(
            (fee) => feesOld[fee] === fees[fee]
        )
    );
};
